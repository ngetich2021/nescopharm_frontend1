<?php

namespace App\Http\Controllers;

use App\Http\Traits\CreatesCustomerAccounts;
use App\Models\Customer;
use App\Models\CustomerApproval;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Two-stage credit-approval workflow for rep-created customers:
 *   pending_stage1 -> (Stage 1 approve) -> pending_documents (CustomerAccount
 *   auto-created here) -> (signed form uploaded) -> pending_stage2 ->
 *   (Stage 2 approve) -> approved. Reject at either stage -> rejected.
 * Both stages are gated by the same 'can_approve_account' permission
 * CustomerAccountApprovalController already uses (company assigns it to
 * whichever roles - e.g. GM, Accountant - should approve).
 */
class CustomerApprovalController extends Controller
{
    use CreatesCustomerAccounts;

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
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * Mirrors DocumentController::generateDocumentNumber() - documents.document_number
     * is NOT NULL + unique, so any direct Document::create() must set it.
     */
    protected function generateDocumentNumber($companyId)
    {
        $prefix = 'DOC-' . substr($companyId, 0, 8) . '-';
        $lastDocument = \Illuminate\Support\Facades\DB::table('documents')
            ->select('document_number')
            ->where('company_id', $companyId)
            ->where('document_number', 'like', $prefix . '%')
            ->orderBy('document_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastDocument ? (int) substr($lastDocument->document_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    protected function getStorageUrl(string $path): string
    {
        if ($this->disk === 's3' || config("filesystems.disks.{$this->disk}.driver") === 's3') {
            try {
                return Storage::disk($this->disk)->temporaryUrl($path, now()->addHours(24));
            } catch (\Exception $e) {
                return Storage::disk($this->disk)->url($path);
            }
        }
        return Storage::disk($this->disk)->url($path);
    }

    public function index(Request $request, $customerId)
    {
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['status' => 'failed', 'message' => 'Customer not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_account_approvals', $customer->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $approvals = CustomerApproval::where('customer_id', $customerId)
            ->with(['approver:id,first_name,last_name,email', 'createdBy:id,first_name,last_name,email'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['status' => 'success', 'data' => $approvals]);
    }

    /**
     * Approve or reject whichever stage the customer is currently awaiting.
     */
    public function store(Request $request, $customerId)
    {
        $user = $request->user();
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['status' => 'failed', 'message' => 'Customer not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_approve_account', $customer->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,rejected',
            'notes' => 'nullable|string',
            // Stage 1 approval only - lets the approver adjust the credit
            // terms they're actually agreeing to grant (which may differ
            // from what the rep originally requested) before the
            // CustomerAccount is created from them.
            'annual_turnover' => 'nullable|numeric|min:0',
            'credit_required' => 'nullable|numeric|min:0',
            'credit_period_required' => 'nullable|string|max:100',
            'credit_period_pd_cheque_days' => 'nullable|integer|min:0|max:365',
            'credit_days' => 'nullable|integer|min:0|max:365',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $stage = match ($customer->approval_status) {
            'pending_stage1' => 'stage1',
            'pending_stage2' => 'stage2',
            default => null,
        };

        if (!$stage) {
            return response()->json([
                'status' => 'failed',
                'message' => "Customer is not currently awaiting approval (status: {$customer->approval_status}).",
            ], 400);
        }

        if ($stage === 'stage2' && $request->input('status') === 'approved') {
            $hasSignedForm = Document::where('documentable_type', Customer::class)
                ->where('documentable_id', $customer->id)
                ->where('document_name', 'Signed Credit Application')
                ->exists();
            if (!$hasSignedForm) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Upload the signed, stamped credit application before giving final approval.',
                ], 422);
            }
        }

        try {
            $approval = CustomerApproval::create([
                'id' => (string) Str::uuid(),
                'customer_id' => $customer->id,
                'approval_type' => $stage,
                'status' => $request->input('status'),
                'approved_by' => $user->id,
                'approved_at' => now(),
                'notes' => $request->input('notes'),
                'company_id' => $customer->company_id,
                'created_by' => $user->id,
            ]);

            if ($request->input('status') === 'rejected') {
                $customer->approval_status = 'rejected';
                $customer->save();
            } elseif ($stage === 'stage1') {
                $pending = $customer->pending_credit_application ?? [];
                // Approver's overrides win over what the rep originally
                // submitted - only fields actually sent in this request are
                // replaced, everything else (directors, suppliers, bank
                // details) still comes from the rep's submission.
                foreach (['annual_turnover', 'credit_required', 'credit_period_required', 'credit_period_pd_cheque_days', 'credit_days'] as $field) {
                    if ($request->filled($field)) {
                        $pending[$field] = $request->input($field);
                    }
                }
                $this->createAccountFromData($customer->id, $customer->company_id, $user->id, $pending);
                $customer->refresh();
                $customer->approval_status = 'pending_documents';
                $customer->save();
            } else { // stage2 approved
                $customer->approval_status = 'approved';
                $customer->save();
            }

            return response()->json([
                'status' => 'success',
                'message' => "Stage " . ($stage === 'stage1' ? '1' : '2') . " {$request->input('status')} successfully.",
                'data' => $approval,
                'customer' => $customer->fresh(),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to process customer approval', ['customer_id' => $customerId, 'error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to process approval: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload the physically signed/stamped credit form scan. Only meaningful
     * once Stage 1 has cleared (approval_status = pending_documents); advances
     * the customer to pending_stage2 on success.
     */
    public function uploadSignedApplication(Request $request, $customerId)
    {
        $user = $request->user();
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['status' => 'failed', 'message' => 'Customer not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_update_customers', $customer->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if ($customer->approval_status !== 'pending_documents') {
            return response()->json([
                'status' => 'failed',
                'message' => "Customer is not awaiting a signed application (status: {$customer->approval_status}).",
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            // Client compresses images before upload, but PDFs and other
            // scans pass through uncompressed - give real headroom instead
            // of a tight 5MB cap that photos routinely blew past.
            'file' => 'required|file|max:15360',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        try {
            $file = $request->file('file');
            $path = 'documents/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
            $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));
            if (!$stored) {
                throw new \Exception('Failed to store the uploaded file.');
            }

            $document = Document::create([
                'id' => (string) Str::uuid(),
                'document_name' => 'Signed Credit Application',
                'document_number' => $this->generateDocumentNumber($customer->company_id),
                'document_image' => $path,
                'documentable_type' => Customer::class,
                'documentable_id' => $customer->id,
                'company_id' => $customer->company_id,
                'created_by' => $user->id,
            ]);

            $customer->approval_status = 'pending_stage2';
            $customer->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Signed credit application uploaded.',
                'document' => array_merge($document->toArray(), ['url' => $this->getStorageUrl($path)]),
                'customer' => $customer->fresh(),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to upload signed credit application', ['customer_id' => $customerId, 'error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to upload signed credit application: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload the GM/approver's own company-stamped copy of the credit
     * application - a separate record from the rep's customer-signed scan
     * (uploadSignedApplication above). Purely a record-keeping attachment:
     * it does not gate or change approval_status, since the approve/reject
     * decision itself never requires a signature or stamp to be uploaded.
     */
    public function uploadStampedApplication(Request $request, $customerId)
    {
        $user = $request->user();
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['status' => 'failed', 'message' => 'Customer not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_approve_account', $customer->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if (!in_array($customer->approval_status, ['pending_stage2', 'approved'], true)) {
            return response()->json([
                'status' => 'failed',
                'message' => "Customer is not at a stage where a stamped copy can be uploaded (status: {$customer->approval_status}).",
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:15360',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        try {
            $file = $request->file('file');
            $path = 'documents/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
            $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));
            if (!$stored) {
                throw new \Exception('Failed to store the uploaded file.');
            }

            $document = Document::create([
                'id' => (string) Str::uuid(),
                'document_name' => 'Company-Stamped Credit Application',
                'document_number' => $this->generateDocumentNumber($customer->company_id),
                'document_image' => $path,
                'documentable_type' => Customer::class,
                'documentable_id' => $customer->id,
                'company_id' => $customer->company_id,
                'created_by' => $user->id,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Company-stamped credit application uploaded.',
                'document' => array_merge($document->toArray(), ['url' => $this->getStorageUrl($path)]),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to upload stamped credit application', ['customer_id' => $customerId, 'error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to upload stamped credit application: ' . $e->getMessage(),
            ], 500);
        }
    }
}
