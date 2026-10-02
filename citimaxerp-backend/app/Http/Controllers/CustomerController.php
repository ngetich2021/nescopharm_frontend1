<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Company;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use App\Http\Traits\HandlesDatabaseErrors;
use Illuminate\Support\Facades\Storage;
use App\Services\CustomerStatementService;
use Carbon\Carbon;

class CustomerController extends Controller
{
    use HandlesDatabaseErrors;

    protected string $disk;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
        $this->disk = config('filesystems.default', 's3');
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

    protected function generateCustomerNumber($companyId)
    {
        $prefix = 'CUST-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastCustomer = DB::table('customers')
            ->select('customer_number')
            ->where('customer_number', 'like', $prefix . '%')
            ->orderBy('customer_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastCustomer ? (int) substr($lastCustomer->customer_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    protected function generateDocumentNumber($companyId)
    {
        $prefix = 'DOC-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastDocument = DB::table('documents')
            ->select('document_number')
            ->where('company_id', $companyId)
            ->where('document_number', 'like', $prefix . '%')
            ->orderBy('document_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastDocument ? (int) substr($lastDocument->document_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    private function formatPhoneNumber($phone)
    {
        if (!$phone) {
            return null;
        }

        // Remove all non-digit characters
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);

        // If phone is empty after cleaning, return null
        if (empty($cleanPhone)) {
            return null;
        }

        // If phone already starts with a 3-digit country code, return as is
        if (strlen($cleanPhone) >= 10 && in_array(substr($cleanPhone, 0, 3), ['254', '256', '255', '250'])) {
            return $cleanPhone;
        }

        // If phone starts with 0, replace with Kenya country code (254)
        if (str_starts_with($cleanPhone, '0')) {
            return '254' . substr($cleanPhone, 1);
        }

        // If phone is 9 digits (local Kenyan number), add country code
        if (strlen($cleanPhone) === 9) {
            return '254' . $cleanPhone;
        }

        // For other cases, assume it's already properly formatted or add default country code if too short
        if (strlen($cleanPhone) < 10) {
            return '254' . $cleanPhone;
        }

        return $cleanPhone;
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_create_customers', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create customers.',
            ], 403);
        }

        $data = $request->all();
        $isBatch = isset($data['customers']) && is_array($data['customers']);
        $customersData = $isBatch ? $data['customers'] : [$data];
        $results = [];

        DB::beginTransaction();
        try {
            foreach ($customersData as $customerData) {
                // Generate unique customer number
                $customerData['customer_number'] = $this->generateCustomerNumber($companyId);

                // Validate required fields
                $validator = Validator::make($customerData, [
                    'name' => 'required|string|max:255',
                    'email' => 'nullable|email|max:255|unique:customers,email',
                    'phone' => 'nullable|string|max:50',
                    'status' => 'nullable|string|in:active,inactive,pending',
                    'payment_method' => 'nullable|string',
                    'address' => 'nullable|string',
                    'city' => 'nullable|string|max:100',
                    'state' => 'nullable|string|max:100',
                    'country' => 'nullable|string|max:100',
                    'postal_code' => 'nullable|string|max:20',
                    'notes' => 'nullable|string',
                    'tags' => 'nullable|array',
                    'tags.*' => 'string|max:50',
                    'preferred_communication_channel' => 'nullable|string',
                    'last_contact_date' => 'nullable|date',
                    'customer_type' => 'nullable|string|in:individual,company',
                    'business_name' => 'nullable|string|max:255',
                    'trading_name' => 'nullable|string|max:255',
                    'business_type' => 'nullable|string|in:pharmacy,hospital_clinic,distributor,ngo,other',
                    'registration_number' => 'nullable|string|max:100',
                    'ppb_license_number' => 'nullable|string|max:100',
                    'website' => 'nullable|string|max:255',
                    'telephone' => 'nullable|string|max:50',
                    'region' => 'nullable|string|max:100',
                    'county' => 'nullable|string|max:100',
                    'nature_of_business' => 'nullable|string|max:255',
                    'pin_number' => 'nullable|required_if:customer_type,company|string|max:100',
                    'contact_person_name' => 'nullable|string|max:255',
                    'contact_person_phone' => 'nullable|string|max:50',
                    'contact_person_email' => 'nullable|email|max:255',
                    'contact_person_designation' => 'nullable|string|max:255',
                    'accounts_contact_name' => 'nullable|string|max:255',
                    'accounts_contact_designation' => 'nullable|string|max:255',
                    'accounts_contact_phone' => 'nullable|string|max:50',
                    'accounts_contact_email' => 'nullable|email|max:255',
                    // Credit-application data a Sales Rep captures at creation time -
                    // materialized into a real CustomerAccount on Stage 1 approval.
                    'credit_application' => 'nullable|array',
                    'credit_application.annual_turnover' => 'nullable|numeric|min:0',
                    'credit_application.credit_required' => 'nullable|numeric|min:0',
                    'credit_application.credit_period_required' => 'nullable|string|max:100',
                    'credit_application.credit_period_pd_cheque_days' => 'nullable|integer|min:0|max:365',
                    'credit_application.directors' => 'nullable|array',
                    'credit_application.suppliers' => 'nullable|array',
                    'credit_application.bank_details' => 'nullable|array',
                ]);
                if ($validator->fails()) {
                    DB::rollBack();
                    return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
                }

                // A Sales Rep creating a customer starts a two-stage credit-approval
                // workflow (see CustomerApprovalController); anyone else creating a
                // customer keeps today's behavior of being immediately usable.
                $isRepCreated = (bool) ($user->role->is_sales_rep ?? false);

                // Create customer
                $customer = Customer::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'customer_number' => $customerData['customer_number'],
                    'name' => $customerData['name'],
                    'email' => $customerData['email'] ?? null,
                    'phone' => $this->formatPhoneNumber($customerData['phone'] ?? null),
                    'status' => $customerData['status'] ?? 'active',
                    'approval_status' => $isRepCreated ? 'pending_stage1' : 'approved',
                    'payment_method' => $customerData['payment_method'] ?? 'cash',
                    'address' => $customerData['address'] ?? null,
                    'city' => $customerData['city'] ?? null,
                    'state' => $customerData['state'] ?? null,
                    'country' => $customerData['country'] ?? 'Kenya',
                    'postal_code' => $customerData['postal_code'] ?? null,
                    'region' => $customerData['region'] ?? null,
                    'county' => $customerData['county'] ?? null,
                    'notes' => $customerData['notes'] ?? null,
                    'tags' => $customerData['tags'] ?? [],
                    'preferred_communication_channel' => $customerData['preferred_communication_channel'] ?? null,
                    'last_contact_date' => $customerData['last_contact_date'] ?? null,
                    'customer_type' => $customerData['customer_type'] ?? null,
                    'business_name' => $customerData['business_name'] ?? null,
                    'trading_name' => $customerData['trading_name'] ?? null,
                    'business_type' => $customerData['business_type'] ?? null,
                    'registration_number' => $customerData['registration_number'] ?? null,
                    'ppb_license_number' => $customerData['ppb_license_number'] ?? null,
                    'website' => $customerData['website'] ?? null,
                    'telephone' => $customerData['telephone'] ?? null,
                    'nature_of_business' => $customerData['nature_of_business'] ?? null,
                    'pin_number' => $customerData['pin_number'] ?? null,
                    'contact_person_name' => $customerData['contact_person_name'] ?? null,
                    'contact_person_phone' => $customerData['contact_person_phone'] ?? null,
                    'contact_person_email' => $customerData['contact_person_email'] ?? null,
                    'contact_person_designation' => $customerData['contact_person_designation'] ?? null,
                    'accounts_contact_name' => $customerData['accounts_contact_name'] ?? null,
                    'accounts_contact_designation' => $customerData['accounts_contact_designation'] ?? null,
                    'accounts_contact_phone' => $customerData['accounts_contact_phone'] ?? null,
                    'accounts_contact_email' => $customerData['accounts_contact_email'] ?? null,
                    'pending_credit_application' => $isRepCreated ? ($customerData['credit_application'] ?? []) : null,
                    'timestamp' => $customerData['timestamp'] ?? null,
                    'created_by' => $user->id,
                ]);

                if ($isRepCreated) {
                    \App\Models\CustomerApproval::create([
                        'id' => (string) Str::uuid(),
                        'customer_id' => $customer->id,
                        'approval_type' => 'stage1',
                        'status' => 'pending',
                        'company_id' => $companyId,
                        'created_by' => $user->id,
                    ]);
                }

                $results[] = $customer;
            }
            DB::commit();
            return response()->json(['status' => 'success', 'customers' => $results], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create customer(s)', [
                'error' => $e->getMessage(),
                'user_id' => $user->id ?? null,
                'request' => $request->all()
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create customer(s): ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $customerId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_customers', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update customers.',
                'data' => null
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'nullable|email|max:255|unique:customers,email,' . $customerId . ',id',
            'phone' => 'nullable|string|max:50',
            'status' => 'sometimes|required|string|in:active,inactive,pending',
            'company' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'notes' => 'nullable|string',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'preferred_communication_channel' => 'nullable|string|in:email,phone,sms,none',
            'last_contact_date' => 'nullable|date',
            'customer_type' => 'nullable|string|in:individual,company',
            'trading_name' => 'nullable|string|max:255',
            'business_type' => 'nullable|string|in:pharmacy,hospital_clinic,distributor,ngo,other',
            'registration_number' => 'nullable|string|max:100',
            'ppb_license_number' => 'nullable|string|max:100',
            'website' => 'nullable|string|max:255',
            'telephone' => 'nullable|string|max:50',
            'region' => 'nullable|string|max:100',
            'county' => 'nullable|string|max:100',
            'contact_person_designation' => 'nullable|string|max:255',
            'accounts_contact_name' => 'nullable|string|max:255',
            'accounts_contact_designation' => 'nullable|string|max:255',
            'accounts_contact_phone' => 'nullable|string|max:50',
            'accounts_contact_email' => 'nullable|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_update_customers', $customer->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit customers.',
            ], 403);
        }

        // Company KRA PIN is printed on every invoice, so it can't be blank.
        $effectiveType = $request->input('customer_type', $customer->customer_type);
        $effectivePin = trim((string) $request->input('pin_number', $customer->pin_number));
        if ($effectiveType === 'company' && $effectivePin === '') {
            return response()->json([
                'status' => 'failed',
                'message' => ['pin_number' => ['KRA PIN is required for company customers.']],
            ], 400);
        }

        try {
            $tags = Arr::wrap($request->input('tags', $customer->tags ?? []));
            // Ensure tags are properly cast to PostgreSQL array
            $tagsForPostgres = empty($tags) ? DB::raw('ARRAY[]::text[]') : DB::raw("ARRAY[" . implode(',', array_map(function ($tag) {
                return "'" . addslashes($tag) . "'";
            }, $tags)) . "]::text[]");

            $customer->forceFill([
                'name' => $request->input('name', $customer->name),
                'email' => $request->input('email', $customer->email),
                'phone' => $request->has('phone') ? $this->formatPhoneNumber($request->input('phone')) : $customer->phone,
                'status' => $request->input('status', $customer->status),
                'address' => $request->input('address', $customer->address),
                'city' => $request->input('city', $customer->city),
                'state' => $request->input('state', $customer->state),
                'country' => $request->input('country', $customer->country),
                'postal_code' => $request->input('postal_code', $customer->postal_code),
                'notes' => $request->input('notes', $customer->notes),
                'tags' => $tagsForPostgres,
                'preferred_communication_channel' => $request->input('preferred_communication_channel', $customer->preferred_communication_channel),
                'last_contact_date' => $request->input('last_contact_date', $customer->last_contact_date),
                'customer_type' => $request->input('customer_type', $customer->customer_type),
                'payment_method' => $request->input('payment_method', $customer->payment_method),
                'contact_person_name' => $request->input('contact_person_name', $customer->contact_person_name),
                'contact_person_phone' => $request->input('contact_person_phone', $customer->contact_person_phone),
                'contact_person_email' => $request->input('contact_person_email', $customer->contact_person_email),
                'contact_person_designation' => $request->input('contact_person_designation', $customer->contact_person_designation),
                'business_name' => $request->input('business_name', $customer->business_name),
                'trading_name' => $request->input('trading_name', $customer->trading_name),
                'business_type' => $request->input('business_type', $customer->business_type),
                'registration_number' => $request->input('registration_number', $customer->registration_number),
                'ppb_license_number' => $request->input('ppb_license_number', $customer->ppb_license_number),
                'website' => $request->input('website', $customer->website),
                'telephone' => $request->input('telephone', $customer->telephone),
                'region' => $request->input('region', $customer->region),
                'county' => $request->input('county', $customer->county),
                'nature_of_business' => $request->input('nature_of_business', $customer->nature_of_business),
                'pin_number' => $request->input('pin_number', $customer->pin_number),
                'accounts_contact_name' => $request->input('accounts_contact_name', $customer->accounts_contact_name),
                'accounts_contact_designation' => $request->input('accounts_contact_designation', $customer->accounts_contact_designation),
                'accounts_contact_phone' => $request->input('accounts_contact_phone', $customer->accounts_contact_phone),
                'accounts_contact_email' => $request->input('accounts_contact_email', $customer->accounts_contact_email),
                'timestamp' => $request->input('timestamp', $customer->timestamp),
            ])->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Customer updated successfully.',
                'customer' => $customer,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update customer', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_customers', $user->company_id)) {
            Log::warning('Unauthorized customer list access', ['user_id' => $user->id, 'company_id' => $user->company_id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customers.',
                'data' => null
            ], 403);
        }

        $query = Customer::where('company_id', $user->company_id);

        // A customer created by a Sales Rep is locked out of search/pickers
        // everywhere (including POS) until it clears both approval stages.
        // Only someone who can actually approve customers may opt into seeing
        // pending applications (e.g. the approvals management screen).
        $includePending = $request->boolean('include_pending')
            && $this->hasPermission($request, 'can_approve_account', $user->company_id);

        // A rep filtering to their own created_by is looking at their own POS
        // activity (e.g. "customers I created, pending or not"), not picking a
        // customer to transact with - let them see their own regardless of
        // approval_status, but not other reps' pending applications.
        $filteringOwnCreations = $request->filled('created_by') && $request->input('created_by') === $user->id;
        if (!$includePending && !$filteringOwnCreations) {
            $query->where('approval_status', 'approved');
        }

        if ($request->filled('created_by')) {
            $query->where('created_by', $request->input('created_by'));
        }

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', "%{$term}%")
                    ->orWhere('business_name', 'ilike', "%{$term}%")
                    ->orWhere('email', 'ilike', "%{$term}%")
                    ->orWhere('phone', 'ilike', "%{$term}%")
                    ->orWhere('city', 'ilike', "%{$term}%")
                    ->orWhere('address', 'ilike', "%{$term}%")
                    ->orWhere('customer_number', 'ilike', "%{$term}%");
            });
        }

        $customers = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Customers retrieved successfully.',
            'data' => $customers
        ]);
    }

    public function showProfile(Request $request, $customer_id)
    {
        $user = $request->user();
        $customer = Customer::find($customer_id);
        if (!$customer) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found.'
            ], 404);
        }
        // Permission check: must have can_view_customers for this company
        if (!$this->hasPermission($request, 'can_view_customers', $customer->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customer profile.'
            ], 403);
        }
        try {
            $customer = Customer::where('id', $customer_id)
                ->where('company_id', $customer->company_id)
                ->with([
                    'orders' => function ($query) {
                        $query->select('id', 'customer_id', 'order_number', 'total_amount', 'status', 'created_at', 'updated_at');
                    },
                    'orders.payments' => function ($query) {
                        $query->select('id', 'order_id', 'amount_paid', 'payment_method', 'status', 'created_at');
                    },
                    'notes' => function ($query) {
                        $query->orderByDesc('created_at');
                    },
                ])
                ->first();

            if (!$customer) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Customer not found or not authorized.',
                ], 404);
            }

            // Calculate total_spend and total_orders
            $orders = $customer->orders ?? collect();
            $total_spend = $orders->sum(function ($order) {
                return (float) $order->total_amount;
            });
            $total_orders = $orders->count();

            // Convert customer to array and override total_spend and total_orders
            $customerArr = $customer->toArray();
            $customerArr['total_spend'] = number_format($total_spend, 2, '.', '');
            $customerArr['total_orders'] = $total_orders;

            // Customer::$notes is ambiguous - it's both a plain text column
            // AND a hasMany(CustomerNote) relation sharing the same name.
            // toArray() merges relationsToArray() over attributesToArray(),
            // so with the relation eager-loaded, $customerArr['notes'] here
            // is actually the array of CustomerNote records, not the plain
            // column (that's only true of direct property access like
            // $customer->notes, which resolves attributes first). Put the
            // note records under their own key, and restore the actual
            // plain-text column for 'notes' so callers expecting a string
            // don't receive an array of objects instead.
            $customerArr['customer_notes'] = $customer->getRelation('notes');
            $customerArr['notes'] = $customer->getAttribute('notes');

            return response()->json([
                'status' => 'success',
                'message' => 'Customer profile retrieved successfully.',
                'customer' => $customerArr,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve customer profile', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve customer profile: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * A customer's account statement for a given period (defaults to the
     * current calendar month) - view/print/PDF-download source data.
     */
    public function statement(Request $request, string $customerId, CustomerStatementService $statementService)
    {
        $user = $request->user();
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['status' => 'failed', 'message' => 'Customer not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_customers', $customer->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view customer statement.'], 403);
        }

        $from = $request->filled('date_from')
            ? Carbon::parse($request->input('date_from'))->startOfDay()
            : Carbon::now()->startOfMonth();
        $to = $request->filled('date_to')
            ? Carbon::parse($request->input('date_to'))->endOfDay()
            : Carbon::now()->endOfMonth();

        try {
            $statement = $statementService->generate($customer->company_id, $customerId, $from, $to);

            return response()->json(['status' => 'success', 'data' => $statement]);
        } catch (\Exception $e) {
            Log::error('Failed to generate customer statement', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate customer statement: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Lightweight credit-terms summary for a customer, used when creating an
     * invoice on credit so staff can see the GM-approved terms already on file
     * (rather than guessing/re-entering them).
     */
    public function creditTerms(Request $request, $customerId)
    {
        $user = $request->user();
        $customer = Customer::where('id', $customerId)
            ->where('company_id', $user->company_id)
            ->with('account:id,customer_id,credit_required,credit_days,credit_terms,pending_credit_limit,pending_credit_days')
            ->first();

        if (!$customer) {
            return response()->json(['status' => 'failed', 'message' => 'Customer not found.'], 404);
        }

        $creditRequired = $customer->account->credit_required ?? null;
        $creditUsed = 0.0;
        $availableCredit = null;

        if ($creditRequired !== null) {
            // Outstanding balance on this customer's credit invoices...
            $creditUsed = (float) Invoice::where('customer_id', $customerId)
                ->where('company_id', $user->company_id)
                ->where('payment_type', 'credit')
                ->whereNotIn('status', ['cancelled'])
                ->sum('balance_amount');

            // ...plus credit orders not yet invoiced (so credit is reserved the moment
            // it's accepted on an order, not just once it becomes an invoice).
            $creditUsed += Order::where('customer_id', $customerId)
                ->where('company_id', $user->company_id)
                ->where('payment_type', 'credit')
                ->where('payment_status', '!=', 'paid')
                ->whereDoesntHave('invoice')
                ->get()
                ->sum(fn ($order) => max(0, (float) $order->final_amount - (float) $order->amount_paid));

            $availableCredit = max(0, (float) $creditRequired - $creditUsed);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'payment_method' => $customer->payment_method,
                'credit_required' => $creditRequired,
                'credit_used' => $creditUsed,
                'available_credit' => $availableCredit,
                'credit_days' => $customer->account->credit_days ?? null,
                'credit_terms' => $customer->account->credit_terms ?? null,
                'has_pending_change' => $customer->account
                    ? (!is_null($customer->account->pending_credit_limit) || !is_null($customer->account->pending_credit_days))
                    : false,
                'customer_account_id' => $customer->account->id ?? null,
            ],
        ]);
    }

    public function destroy(Request $request, $customerId)
    {
        $user = $request->user();
        // Use withTrashed to allow for soft-deleted lookup
        $customer = Customer::withTrashed()->find($customerId);
        if (!$customer) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found.'
            ], 404);
        }
        // Permission check: must have can_delete_customers for this company
        if (!$this->hasPermission($request, 'can_delete_customers', $customer->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete customers.'
            ], 403);
        }
        try {
            // Only soft delete if not already deleted
            if (is_null($customer->deleted_at)) {
                $customer->delete();
            }
            return response()->json([
                'status' => 'success',
                'message' => 'Customer deleted successfully.'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete customer', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all documents for a specific customer
     */
    public function getDocuments(Request $request, $customerId)
    {
        $user = $request->user();

        // Clean the customer ID to remove any extra characters
        $customerId = trim($customerId, '{}');

        $customer = Customer::find($customerId);

        if (!$customer) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found.'
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_customers', $customer->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customer documents.',
                'data' => null
            ], 403);
        }

        try {
            $documents = $customer->documents()->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Customer documents retrieved successfully.',
                'data' => $documents
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve customer documents', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve customer documents: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create a new document for a specific customer
     */
    public function createDocument(Request $request, $customerId)
    {
        $user = $request->user();
        $customer = Customer::find($customerId);

        if (!$customer) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found.'
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_create_documents', $customer->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create customer documents.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'document_name' => 'required|string|max:255',
            'reference_number' => 'nullable|string|max:100',
            'expiry_date' => 'nullable|date',
            'regulatory_body' => 'nullable|string|max:255',
            'other_information' => 'nullable|string',
            'document_image' => 'nullable|file|max:15360',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $documentImageUrl = null;
        if ($request->hasFile('document_image')) {
            $file = $request->file('document_image');
            try {
                $path = 'documents/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
                $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

                if ($stored) {
                    $documentImageUrl = Storage::disk($this->disk)->url($path);
                } else {
                    throw new \Exception('Failed to store document image');
                }
            } catch (\Exception $e) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Document image upload failed: ' . $e->getMessage(),
                ], 500);
            }
        }

        try {
            $documentNumber = $this->generateDocumentNumber($customer->company_id);
            $document = Document::create([
                'id' => (string) Str::uuid(),
                'document_name' => $request->input('document_name'),
                'document_number' => $documentNumber,
                'reference_number' => $request->input('reference_number'),
                'expiry_date' => $request->input('expiry_date'),
                'regulatory_body' => $request->input('regulatory_body'),
                'document_image' => $documentImageUrl,
                'documentable_type' => Customer::class,
                'documentable_id' => $customerId,
                'company_id' => $customer->company_id,
                'created_by' => $user->id,
                'other_information' => $request->input('other_information'),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Customer document created successfully.',
                'data' => $document,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create customer document', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create customer document: ' . $e->getMessage(),
            ], 500);
        }
    }
}
