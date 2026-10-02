<?php

namespace App\Http\Controllers;

use App\Http\Traits\CreatesCustomerAccounts;
use App\Models\CustomerAccount;
use App\Models\AccountDirector;
use App\Models\AuthorisedPurchasePerson;
use App\Models\AccountSupplier;
use App\Models\AccountBankDetail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class CustomerAccountController extends Controller
{
    use CreatesCustomerAccounts;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        // System admin: can manage everything
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        // Company admin: can manage their own company only
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        // Fallback: check specific permission
        return $role->hasPermission($permission);
    }
    public function index(Request $request)
    {
        $user = $request->user();
        // A customer account is just the credit/payment side of a customer
        // record - anyone authorised to view customers must see it too, not
        // just holders of the separate can_view_accounts permission.
        if (!$this->hasPermission($request, 'can_view_accounts', $user->company_id)
            && !$this->hasPermission($request, 'can_view_customers', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view accounts.',
                'data' => null
            ], 403);
        }
        $accounts = CustomerAccount::with([
            'directors',
            'authorisedPurchasePersons',
            'suppliers',
            'bankDetails',
            'documents',
            'customer',
            'approvals' => function($query) {
                $query->with(['approver:id,first_name,last_name,email', 'createdBy:id,first_name,last_name,email'])
                      ->orderBy('created_at', 'desc');
            },
            'latestApproval' => function($query) {
                $query->with(['approver:id,first_name,last_name,email', 'createdBy:id,first_name,last_name,email']);
            }
        ])->where('company_id', $user->company_id)->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Customer accounts retrieved successfully.',
            'data' => $accounts
        ]);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        // Same reasoning as index(): viewing a customer must never gatekeep
        // the credit/payment details captured for that same customer.
        if (!$this->hasPermission($request, 'can_view_accounts', $user->company_id)
            && !$this->hasPermission($request, 'can_view_customers', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this account.'
            ], 403);
        }
        $user = $request->user();
        $account = CustomerAccount::with([
            'directors',
            'authorisedPurchasePersons',
            'suppliers',
            'bankDetails',
            'documents',
            'customer',
            'approvals' => function($query) {
                $query->with(['approver:id,first_name,last_name,email', 'createdBy:id,first_name,last_name,email'])
                      ->orderBy('created_at', 'desc');
            },
            'latestApproval' => function($query) {
                $query->with(['approver:id,first_name,last_name,email', 'createdBy:id,first_name,last_name,email']);
            }
        ])->find($id);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer account not found.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Customer account retrieved successfully.',
            'data' => $account
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create accounts.',
            ], 403);
        }
    $validator = Validator::make($request->all(), [
            'customer_id' => 'required|uuid|exists:customers,id',
            'certificate_of_incorporation_number' => 'nullable|string|max:100',
            'company_type' => 'nullable|string|max:100',
            'annual_turnover' => 'nullable|numeric|min:0',
            'credit_required' => 'nullable|numeric|min:0',
            'credit_period_required' => 'nullable|string|max:100',
            'credit_period_pd_cheque_days' => 'nullable|integer|min:0|max:365',
            'credit_days' => 'nullable|integer|min:0|max:3650',
            'currently_defaulted' => 'nullable|boolean',
            'credit_terms' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'directors' => 'nullable|array',
            'directors.*.name' => 'required_with:directors|string|max:255',
            // ID/passport number is genuinely not always on hand when this
            // form is captured - it must not block saving everything else
            // (bank details, credit terms, suppliers) that was filled in.
            'directors.*.id_passport_number' => 'nullable|string|max:100',
            'directors.*.pin' => 'nullable|string|max:100',
            'directors.*.phone_number' => 'nullable|string|max:50',
            'authorised_purchase_persons' => 'nullable|array',
            'authorised_purchase_persons.*.name' => 'required_with:authorised_purchase_persons|string|max:255',
            'authorised_purchase_persons.*.phone_number' => 'nullable|string|max:50',
            'suppliers' => 'nullable|array',
            'suppliers.*.name' => 'required_with:suppliers|string|max:255',
            'suppliers.*.contact_person_name' => 'nullable|string|max:255',
            'suppliers.*.phone_number' => 'nullable|string|max:50',
            'suppliers.*.credit_limit' => 'nullable|numeric|min:0',
            'bank_details' => 'nullable|array',
            'bank_details.*.bank_name' => 'required_with:bank_details|string|max:255',
            'bank_details.*.branch' => 'nullable|string|max:255',
            'bank_details.*.account_number' => 'nullable|string|max:100',
            // Multiple documents: array of metadata
            'documents' => 'nullable|array',
            'documents.*.document_name' => 'required_with:documents|string|max:255',
            'documents.*.reference_number' => 'nullable|string|max:100',
            'documents.*.expiry_date' => 'nullable|date',
            'documents.*.regulatory_body' => 'nullable|string|max:255',
            'documents.*.other_information' => 'nullable|string',
            // Files: document_images[]
            'document_images' => 'nullable|array',
            'document_images.*' => 'nullable|file|max:15360',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $account = $this->createAccountFromData(
                $request->input('customer_id'),
                $user->company_id,
                $user->id,
                $request->only([
                    'certificate_of_incorporation_number',
                    'company_type',
                    'annual_turnover',
                    'credit_required',
                    'credit_period_required',
                    'credit_period_pd_cheque_days',
                    'credit_days',
                    'currently_defaulted',
                    'credit_terms',
                    'notes',
                    'directors',
                    'authorised_purchase_persons',
                    'suppliers',
                    'bank_details',
                ])
            );

            // Handle multiple document uploads if provided
            $documents = [];
            $docMetas = $request->input('documents', []);
            $docFiles = $request->file('document_images', []);
            foreach ($docMetas as $i => $meta) {
                $documentData = [
                    'id' => (string) Str::uuid(),
                    'document_name' => $meta['document_name'] ?? null,
                    'reference_number' => $meta['reference_number'] ?? null,
                    'expiry_date' => $meta['expiry_date'] ?? null,
                    'regulatory_body' => $meta['regulatory_body'] ?? null,
                    'other_information' => $meta['other_information'] ?? null,
                    'documentable_type' => \App\Models\CustomerAccount::class,
                    'documentable_id' => $account->id,
                    'company_id' => $user->company_id,
                    'created_by' => $user->id,
                ];
                if (isset($docFiles[$i])) {
                    $file = $docFiles[$i];
                    $path = $file->store('documents', 'public');
                    $documentData['document_image'] = $path;
                }
                $documents[] = \App\Models\Document::create($documentData);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Customer account created successfully.',
                'data' => $account,
                'documents' => $documents,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create customer account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create customer account: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update accounts.',
            ], 403);
        }
        $account = CustomerAccount::find($id);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer account not found.'
            ], 404);
        }

    $validator = Validator::make($request->all(), [
            'account_number' => 'sometimes|required|string|unique:customer_accounts,account_number,' . $id . ',id',
            'nature_of_business' => 'nullable|string|max:255',
            'certificate_of_incorporation_number' => 'nullable|string|max:100',
            'company_type' => 'nullable|string|max:100',
            'pin_number' => 'nullable|string|max:100',
            'annual_turnover' => 'nullable|numeric|min:0',
            'credit_required' => 'nullable|numeric|min:0',
            'credit_period_required' => 'nullable|string|max:100',
            'credit_days' => 'nullable|integer|min:0|max:3650',
            'currently_defaulted' => 'nullable|boolean',
            'credit_terms' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'reviewed_by_name' => 'nullable|string|max:255',
            'reviewed_by_position' => 'nullable|string|max:255',
            // Multiple documents: array of metadata for update
            'documents' => 'nullable|array',
            'documents.*.id' => 'nullable|string|exists:documents,id',
            'documents.*.document_name' => 'required_with:documents|string|max:255',
            'documents.*.reference_number' => 'nullable|string|max:100',
            'documents.*.expiry_date' => 'nullable|date',
            'documents.*.regulatory_body' => 'nullable|string|max:255',
            'documents.*.other_information' => 'nullable|string',
            // Files: document_images[]
            'document_images' => 'nullable|array',
            'document_images.*' => 'nullable|file|max:15360',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            // NOTE: nature_of_business/pin_number are NOT columns on customer_accounts
            // (see Model comment) - they used to be force-filled here unconditionally,
            // which made every update() call throw a DB "unknown column" error. That
            // data lives on the linked Customer; update it there instead if needed.
            $account->forceFill([
                'account_number' => $request->input('account_number', $account->account_number),
                'certificate_of_incorporation_number' => $request->input('certificate_of_incorporation_number', $account->certificate_of_incorporation_number),
                'company_type' => $request->input('company_type', $account->company_type),
                'annual_turnover' => $request->input('annual_turnover', $account->annual_turnover),
                'credit_required' => $request->input('credit_required', $account->credit_required),
                'credit_period_required' => $request->input('credit_period_required', $account->credit_period_required),
                'credit_period_pd_cheque_days' => $request->input('credit_period_pd_cheque_days', $account->credit_period_pd_cheque_days),
                'credit_days' => $request->input('credit_days', $account->credit_days),
                'currently_defaulted' => $request->input('currently_defaulted', $account->currently_defaulted),
                'credit_terms' => $request->input('credit_terms', $account->credit_terms),
                'notes' => $request->input('notes', $account->notes),
                'reviewed_by_name' => $request->input('reviewed_by_name', $account->reviewed_by_name),
                'reviewed_by_position' => $request->input('reviewed_by_position', $account->reviewed_by_position),
            ])->save();

            // Update Directors
            if ($request->has('directors')) {
                // Delete existing directors
                AccountDirector::where('customer_account_id', $account->id)->delete();
                // Add new directors
                foreach ($request->input('directors', []) as $director) {
                    AccountDirector::create([
                        'id' => (string) Str::uuid(),
                        'customer_account_id' => $account->id,
                        'name' => $director['name'],
                        'id_passport_number' => $director['id_passport_number'] ?? null,
                        'pin' => $director['pin'] ?? null,
                        'phone_number' => $director['phone_number'] ?? null,
                    ]);
                }
            }

            // Update Authorised Purchase Persons
            if ($request->has('authorised_purchase_persons')) {
                AuthorisedPurchasePerson::where('customer_account_id', $account->id)->delete();
                foreach ($request->input('authorised_purchase_persons', []) as $person) {
                    AuthorisedPurchasePerson::create([
                        'id' => (string) Str::uuid(),
                        'customer_account_id' => $account->id,
                        'name' => $person['name'],
                        'phone_number' => $person['phone_number'] ?? null,
                    ]);
                }
            }

            // Update Suppliers
            if ($request->has('suppliers')) {
                AccountSupplier::where('customer_account_id', $account->id)->delete();
                foreach ($request->input('suppliers', []) as $supplier) {
                    AccountSupplier::create([
                        'id' => (string) Str::uuid(),
                        'customer_account_id' => $account->id,
                        'name' => $supplier['name'],
                        'contact_person_name' => $supplier['contact_person_name'] ?? null,
                        'phone_number' => $supplier['phone_number'] ?? null,
                        'credit_limit' => $supplier['credit_limit'] ?? null,
                    ]);
                }
            }

            // Update Bank Details
            if ($request->has('bank_details')) {
                AccountBankDetail::where('customer_account_id', $account->id)->delete();
                foreach ($request->input('bank_details', []) as $bank) {
                    AccountBankDetail::create([
                        'id' => (string) Str::uuid(),
                        'customer_account_id' => $account->id,
                        'bank_name' => $bank['bank_name'],
                        'branch' => $bank['branch'] ?? null,
                        'account_number' => $bank['account_number'] ?? null,
                    ]);
                }
            }

            // Handle document updates
            $docMetas = $request->input('documents', []);
            $docFiles = $request->file('document_images', []);
            $updatedDocuments = [];
            foreach ($docMetas as $i => $meta) {
                if (!empty($meta['id'])) {
                    // Update existing document
                    $document = \App\Models\Document::find($meta['id']);
                    if ($document && $document->documentable_type === \App\Models\CustomerAccount::class && $document->documentable_id === $account->id) {
                        $document->fill([
                            'document_name' => $meta['document_name'] ?? $document->document_name,
                            'reference_number' => $meta['reference_number'] ?? $document->reference_number,
                            'expiry_date' => $meta['expiry_date'] ?? $document->expiry_date,
                            'regulatory_body' => $meta['regulatory_body'] ?? $document->regulatory_body,
                            'other_information' => $meta['other_information'] ?? $document->other_information,
                        ]);
                        if (isset($docFiles[$i])) {
                            $file = $docFiles[$i];
                            $path = $file->store('documents', 'public');
                            $document->document_image = $path;
                        }
                        $document->save();
                        $updatedDocuments[] = $document;
                    }
                } else {
                    // Add new document
                    $documentData = [
                        'id' => (string) Str::uuid(),
                        'document_name' => $meta['document_name'] ?? null,
                        'reference_number' => $meta['reference_number'] ?? null,
                        'expiry_date' => $meta['expiry_date'] ?? null,
                        'regulatory_body' => $meta['regulatory_body'] ?? null,
                        'other_information' => $meta['other_information'] ?? null,
                        'documentable_type' => \App\Models\CustomerAccount::class,
                        'documentable_id' => $account->id,
                        'company_id' => $account->company_id,
                        'created_by' => $user->id,
                    ];
                    if (isset($docFiles[$i])) {
                        $file = $docFiles[$i];
                        $path = $file->store('documents', 'public');
                        $documentData['document_image'] = $path;
                    }
                    $updatedDocuments[] = \App\Models\Document::create($documentData);
                }
            }
            // Optionally, handle document deletion if you want to support it (e.g., via a deleted_documents array)

            return response()->json([
                'status' => 'success',
                'message' => 'Customer account updated successfully.',
                'data' => $account,
                'documents' => $updatedDocuments,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update customer account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update customer account: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete accounts.',
            ], 403);
        }
        $account = CustomerAccount::find($id);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer account not found.'
            ], 404);
        }
        try {
            $account->delete();
            return response()->json([
                'status' => 'success',
                'message' => 'Customer account deleted successfully.'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete customer account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete customer account: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Request a credit limit update (creates pending approval)
     */
    public function requestCreditLimitUpdate(Request $request, $id)
    {
        $user = $request->user();
        
        if (!$this->hasPermission($request, 'can_request_credit_updates', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to request credit limit updates.',
            ], 403);
        }

        $account = CustomerAccount::find($id);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer account not found.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'requested_credit_limit' => 'nullable|numeric|min:0',
            'requested_credit_days' => 'nullable|integer|min:0|max:3650',
            'reason' => 'nullable|string|max:500',
            'justification' => 'nullable|string|max:1000',
            'supporting_documents' => 'nullable|array',
        ]);

        if (!$request->filled('requested_credit_limit') && !$request->filled('requested_credit_days')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Provide a requested credit limit and/or a requested credit period (days).',
            ], 400);
        }

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $currentCreditLimit = $account->credit_required ?? 0;
            $requestedCreditLimit = $request->filled('requested_credit_limit') ? $request->input('requested_credit_limit') : $currentCreditLimit;
            $currentCreditDays = $account->credit_days;
            $requestedCreditDays = $request->filled('requested_credit_days') ? (int) $request->input('requested_credit_days') : $currentCreditDays;

            // Check if there's already a pending request
            if ($account->has_pending_credit_change) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'There is already a pending credit terms change for this account. Please wait for approval or cancellation.',
                    'data' => [
                        'current_pending_request' => $account->pending_credit_info
                    ]
                ], 400);
            }

            // Update the account with the pending terms - only credit_days actually used
            // for invoicing (via resolveInvoiceCredit) once a GM approves this request.
            $account->update([
                'pending_credit_limit' => $requestedCreditLimit,
                'pending_credit_days' => $requestedCreditDays,
            ]);

            // Create a pending approval record
            $approvalData = [
                'id' => (string) Str::uuid(),
                'customer_account_id' => $id,
                'approved_by' => null, // Will be set when approved
                'approved_at' => null, // Will be set when approved
                'status' => 'pending',
                'notes' => $request->input('reason', 'Credit terms update requested'),
                'company_id' => $user->company_id,
                'created_by' => $user->id,
                'approval_type' => 'credit_limit_update',
                'previous_credit_limit' => $currentCreditLimit,
                'new_credit_limit' => $requestedCreditLimit,
                'previous_credit_days' => $currentCreditDays,
                'new_credit_days' => $requestedCreditDays,
                'metadata' => [
                    'justification' => $request->input('justification'),
                    'supporting_documents' => $request->input('supporting_documents', []),
                    'request_date' => now()->toISOString(),
                    'requested_by' => $user->id
                ],
            ];

            $approval = \App\Models\CustomerAccountApproval::create($approvalData);

            Log::info('Credit terms update requested', [
                'customer_account_id' => $id,
                'requested_by' => $user->id,
                'current_limit' => $currentCreditLimit,
                'requested_limit' => $requestedCreditLimit,
                'current_days' => $currentCreditDays,
                'requested_days' => $requestedCreditDays,
                'approval_id' => $approval->id
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Credit terms update request submitted successfully. Awaiting GM approval.',
                'data' => [
                    'approval_request' => $approval,
                    'account_info' => [
                        'current_credit_limit' => $currentCreditLimit,
                        'requested_credit_limit' => $requestedCreditLimit,
                        'change_amount' => $requestedCreditLimit - $currentCreditLimit,
                        'change_type' => $requestedCreditLimit > $currentCreditLimit ? 'increase' : 'decrease',
                        'current_credit_days' => $currentCreditDays,
                        'requested_credit_days' => $requestedCreditDays,
                    ]
                ]
            ], 201);

        } catch (\Exception $e) {
            Log::error('Failed to request credit limit update', [
                'customer_account_id' => $id,
                'requested_by' => $user->id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to submit credit limit update request: ' . $e->getMessage(),
            ], 500);
        }
    }
}
