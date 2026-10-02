<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Store;
use App\Models\CompanyAccountingSettings;
use App\Services\AccountingWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpenseController extends Controller
{
    protected AccountingWorkflowService $accountingWorkflow;

    public function __construct(AccountingWorkflowService $accountingWorkflow)
    {
        $this->middleware('auth:sanctum');
        $this->accountingWorkflow = $accountingWorkflow;
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
     * Display a listing of expenses.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_expenses', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view expenses.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = Expense::with(['category', 'createdBy', 'approvedBy']);

            // Filter by company
            if (!$this->hasPermission($request, 'can_manage_all_expenses')) {
                $query->where('company_id', $user->company_id);
            } else if ($request->filled('company_id')) {
                $query->where('company_id', $request->input('company_id'));
            }

            // Apply filters
            if ($request->filled('category_id')) {
                $query->where('category_id', $request->input('category_id'));
            }

            if ($request->filled('store_id')) {
                $query->where('store_id', $request->input('store_id'));
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            if ($request->filled('vendor_name')) {
                $query->where('vendor_name', 'ilike', '%' . $request->input('vendor_name') . '%');
            }

            if ($request->filled('payment_method')) {
                $query->where('payment_method', $request->input('payment_method'));
            }

            if ($request->filled('is_recurring')) {
                $query->where('is_recurring', $request->boolean('is_recurring'));
            }

            if ($request->filled('created_by')) {
                $query->where('created_by', $request->input('created_by'));
            }

            if ($request->filled('start_date') && $request->filled('end_date')) {
                $query->whereBetween('expense_date', [
                    $request->input('start_date'),
                    $request->input('end_date')
                ]);
            } else if ($request->filled('start_date')) {
                $query->where('expense_date', '>=', $request->input('start_date'));
            } else if ($request->filled('end_date')) {
                $query->where('expense_date', '<=', $request->input('end_date'));
            }

            if ($request->filled('min_amount')) {
                $query->where('amount', '>=', $request->input('min_amount'));
            }

            if ($request->filled('max_amount')) {
                $query->where('amount', '<=', $request->input('max_amount'));
            }

            if ($request->filled('tag')) {
                $tag = $request->input('tag');
                $query->whereRaw("? = ANY(tags)", [$tag]);
            }

            // Apply search
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('vendor_name', 'ilike', '%' . $search . '%')
                      ->orWhere('description', 'ilike', '%' . $search . '%')
                      ->orWhere('notes', 'ilike', '%' . $search . '%');
                });
            }

            // Apply sorting
            $sortField = $request->input('sort_by', 'expense_date');
            $sortDirection = $request->input('sort_direction', 'desc');
            $query->orderBy($sortField, $sortDirection);

            // Get all expenses
            $expenses = $query->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Expenses retrieved successfully.',
                'expenses' => $expenses,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve expenses', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve expenses: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created expense in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_expenses', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create expenses.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'category_id' => 'required|uuid|exists:expense_categories,id',
            'store_id' => 'nullable|uuid|exists:stores,id',
            'vendor_name' => 'required|string|max:255',
            'description' => 'required|string',
            'amount' => 'required|numeric|min:0.01|max:9999999.99',
            'expense_date' => 'required|date',
            'payment_method' => 'required|string|in:cash,card,bank_transfer,check,other',
            'receipt_url' => 'nullable|string|url',
            'notes' => 'nullable|string',
            'is_recurring' => 'sometimes|boolean',
            'recurring_frequency' => 'required_if:is_recurring,true|nullable|string|in:weekly,monthly,quarterly,yearly',
            'tags' => 'nullable|array',
            'tags.*' => 'string',
            'status' => 'sometimes|string|in:pending,approved,rejected,paid',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $companyId = $user->company_id;

            // Check if the company exists and user has permission
            if (!$companyId) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'User is not associated with a company.',
                ], 400);
            }

            // Check if the expense category belongs to the user's company
            $category = ExpenseCategory::find($request->input('category_id'));
            if (!$category || $category->company_id !== $companyId) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'The selected expense category does not belong to your company.',
                ], 403);
            }

            // If store_id is provided, check if it belongs to the user's company
            if ($request->filled('store_id')) {
                $store = Store::find($request->input('store_id'));
                if (!$store || $store->company_id !== $companyId) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'The selected store does not belong to your company.',
                    ], 403);
                }
            }

            // Create the expense
            $expense = Expense::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'category_id' => $request->input('category_id'),
                'store_id' => $request->input('store_id'),
                'vendor_name' => $request->input('vendor_name'),
                'description' => $request->input('description'),
                'amount' => $request->input('amount'),
                'expense_date' => $request->input('expense_date'),
                'payment_method' => $request->input('payment_method'),
                'receipt_url' => $request->input('receipt_url'),
                'notes' => $request->input('notes'),
                'is_recurring' => $request->input('is_recurring', false),
                'recurring_frequency' => $request->input('recurring_frequency'),
                'tags' => $request->input('tags', []),
                'status' => $request->input('status', 'pending'),
                'created_by' => $user->id,
            ]);

            // Create accounting entry based on company settings
            // Some companies record expenses immediately, others on approval
            try {
                $settings = CompanyAccountingSettings::getForCompany($companyId);
                
                if ($settings->shouldRecordExpenseAt(CompanyAccountingSettings::EXPENSE_TRIGGER_CREATED)) {
                    $result = $this->accountingWorkflow
                        ->forCompany($companyId)
                        ->asUser($user->id)
                        ->onExpenseRecorded(
                            $expense->amount,
                            $expense->payment_method,
                            $expense->description ?? 'Expense - ' . ($category->name ?? 'General'),
                            $category->name ?? null
                        );
                        
                    if ($result) {
                        Log::info('Accounting entry created for expense on creation', [
                            'expense_id' => $expense->id,
                            'journal_id' => $result['journal_id'] ?? null
                        ]);
                    }
                } else {
                    Log::info('Accounting entry skipped for expense (trigger not on creation)', [
                        'expense_id' => $expense->id,
                        'trigger_setting' => $settings->expense_recognition_trigger
                    ]);
                }
            } catch (\Exception $accountingError) {
                // Log but don't fail - accounting can be reconciled later
                Log::warning('Failed to create accounting entry for expense', [
                    'expense_id' => $expense->id,
                    'error' => $accountingError->getMessage()
                ]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Expense created successfully.',
                'expense' => $expense->load(['category', 'store', 'createdBy']),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create expense', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create expense: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified expense.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_expenses', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view expenses.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = Expense::where('id', $id)
                ->with(['category', 'store', 'createdBy', 'approvedBy']);

            if (!$this->hasPermission($request, 'can_manage_all_expenses')) {
                $query->where('company_id', $user->company_id);
            }

            $expense = $query->first();

            if (!$expense) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense not found or not authorized to view.',
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Expense retrieved successfully.',
                'expense' => $expense,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve expense', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve expense: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified expense in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_expenses', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update expenses.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'category_id' => 'sometimes|required|uuid|exists:expense_categories,id',
            'store_id' => 'nullable|uuid|exists:stores,id',
            'vendor_name' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|required|string',
            'amount' => 'sometimes|required|numeric|min:0.01|max:9999999.99',
            'expense_date' => 'sometimes|required|date',
            'payment_method' => 'sometimes|required|string|in:cash,card,bank_transfer,check,other',
            'receipt_url' => 'nullable|string|url',
            'notes' => 'nullable|string',
            'is_recurring' => 'sometimes|boolean',
            'recurring_frequency' => 'required_if:is_recurring,true|nullable|string|in:weekly,monthly,quarterly,yearly',
            'tags' => 'nullable|array',
            'tags.*' => 'string',
            'status' => 'sometimes|string|in:pending,approved,rejected,paid',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            
            // Find the expense
            $expense = Expense::find($id);
            if (!$expense) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense not found.',
                ], 404);
            }

            // Check authorization
            if (!$this->hasPermission($request, "can_update_expenses", $expense->company_id)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to update this expense.',
                ], 403);
            }

            // Check if the expense category belongs to the expense's company
            if ($request->filled('category_id')) {
                $category = ExpenseCategory::find($request->input('category_id'));
                if (!$category || $category->company_id !== $expense->company_id) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'The selected expense category does not belong to the same company as the expense.',
                    ], 403);
                }
            }

            // If store_id is provided, check if it belongs to the expense's company
            if ($request->filled('store_id')) {
                $store = Store::find($request->input('store_id'));
                if (!$store || $store->company_id !== $expense->company_id) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'The selected store does not belong to the same company as the expense.',
                    ], 403);
                }
            }

            // Check for status update and handle approval
            $oldStatus = $expense->status;
            $newStatus = $request->input('status');
            
            if ($newStatus && $oldStatus !== $newStatus && $newStatus === 'approved') {
                if (!$this->hasPermission($request, 'can_approve_expenses', $user->company_id)) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to approve expenses.',
                    ], 403);
                }
                
                // Set the approver
                $expense->approved_by = $user->id;
            }

            // Update the expense
            $expense->update($request->only([
                'category_id',
                'store_id',
                'vendor_name',
                'description',
                'amount',
                'expense_date',
                'payment_method',
                'receipt_url',
                'notes',
                'is_recurring',
                'recurring_frequency',
                'tags',
                'status',
            ]));

            return response()->json([
                'status' => 'success',
                'message' => 'Expense updated successfully.',
                'expense' => $expense->fresh(['category', 'store', 'createdBy', 'approvedBy']),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update expense', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update expense: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified expense from storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_expenses', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete expenses.',
            ], 403);
        }

        try {
            $user = $request->user();
            
            // Find the expense
            $expense = Expense::find($id);
            if (!$expense) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense not found.',
                ], 404);
            }

            // Check authorization
            if (!$this->hasPermission($request, "can_delete_expenses", $expense->company_id)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to delete this expense.',
                ], 403);
            }

            // Additional authorization for approved expenses
            if ($expense->status === 'approved' || $expense->status === 'paid') {
                if (!$this->hasPermission($request, 'can_delete_approved_expenses')) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to delete approved or paid expenses.',
                    ], 403);
                }
            }

            // Delete the expense
            $expense->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Expense deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete expense', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete expense: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Approve the specified expense.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function approve(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_approve_expenses')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve expenses.',
            ], 403);
        }

        try {
            $user = $request->user();
            
            // Find the expense
            $expense = Expense::find($id);
            if (!$expense) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense not found.',
                ], 404);
            }

            // Check authorization
            if (!$this->hasPermission($request, "can_approve_expenses", $expense->company_id)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to approve this expense.',
                ], 403);
            }

            // Check if expense is already approved
            if ($expense->status === 'approved') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense is already approved.',
                ], 409);
            }

            // Check if expense is rejected
            if ($expense->status === 'rejected') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot approve a rejected expense.',
                ], 409);
            }

            // Approve the expense
            $expense->update([
                'status' => 'approved',
                'approved_by' => $user->id,
            ]);

            // Create accounting entry based on company settings
            // Some companies record expenses on creation, others on approval
            try {
                $settings = CompanyAccountingSettings::getForCompany($expense->company_id);
                
                if ($settings->shouldRecordExpenseAt(CompanyAccountingSettings::EXPENSE_TRIGGER_APPROVED)) {
                    $result = $this->accountingWorkflow
                        ->forCompany($expense->company_id)
                        ->asUser($user->id)
                        ->onExpenseRecorded(
                            $expense->amount,
                            $expense->payment_method,
                            $expense->description ?? 'Expense - ' . ($expense->category->name ?? 'General'),
                            $expense->category->name ?? null
                        );
                        
                    if ($result) {
                        Log::info('Accounting entry created for approved expense', [
                            'expense_id' => $expense->id,
                            'journal_id' => $result['journal_id'] ?? null
                        ]);
                    }
                }
            } catch (\Exception $accountingError) {
                // Log but don't fail - accounting can be reconciled later
                Log::warning('Failed to create accounting entry for expense', [
                    'expense_id' => $expense->id,
                    'error' => $accountingError->getMessage()
                ]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Expense approved successfully.',
                'expense' => $expense->fresh(['category', 'store', 'createdBy', 'approvedBy']),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to approve expense', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to approve expense: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject the specified expense.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function reject(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_approve_expenses')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to reject expenses.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'rejection_reason' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            
            // Find the expense
            $expense = Expense::find($id);
            if (!$expense) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense not found.',
                ], 404);
            }

            // Check authorization
            if (!$this->hasPermission($request, "can_approve_expenses", $expense->company_id)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to reject this expense.',
                ], 403);
            }

            // Check if expense is already rejected
            if ($expense->status === 'rejected') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense is already rejected.',
                ], 409);
            }

            // Check if expense is already paid
            if ($expense->status === 'paid') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot reject a paid expense.',
                ], 409);
            }

            // Add rejection reason to notes
            $notes = $expense->notes ? $expense->notes . "\n\n" : "";
            $notes .= "Rejected by " . $user->name . " on " . now()->format('Y-m-d H:i:s') . ".\n";
            $notes .= "Reason: " . $request->input('rejection_reason');

            // Reject the expense
            $expense->update([
                'status' => 'rejected',
                'approved_by' => $user->id, // We record who rejected it
                'notes' => $notes,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Expense rejected successfully.',
                'expense' => $expense->fresh(['category', 'store', 'createdBy', 'approvedBy']),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to reject expense', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to reject expense: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark the specified expense as paid.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function markAsPaid(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_manage_payments')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to mark expenses as paid.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'payment_date' => 'required|date',
            'payment_notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            
            // Find the expense
            $expense = Expense::find($id);
            if (!$expense) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense not found.',
                ], 404);
            }

            // Check authorization
            if (!$this->hasPermission($request, "can_manage_company", $expense->company_id)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to mark this expense as paid.',
                ], 403);
            }

            // Check if expense is already paid
            if ($expense->status === 'paid') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense is already marked as paid.',
                ], 409);
            }

            // Check if expense is approved
            if ($expense->status !== 'approved') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Only approved expenses can be marked as paid.',
                ], 409);
            }

            // Add payment information to notes
            $notes = $expense->notes ? $expense->notes . "\n\n" : "";
            $notes .= "Marked as paid by " . $user->name . " on " . now()->format('Y-m-d H:i:s') . ".\n";
            $notes .= "Payment date: " . $request->input('payment_date') . "\n";
            
            if ($request->filled('payment_notes')) {
                $notes .= "Payment notes: " . $request->input('payment_notes');
            }

            // Mark the expense as paid
            $expense->update([
                'status' => 'paid',
                'notes' => $notes,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Expense marked as paid successfully.',
                'expense' => $expense->fresh(['category', 'store', 'createdBy', 'approvedBy']),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to mark expense as paid', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to mark expense as paid: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get expense summary statistics.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function summary(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_expenses')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view expense summary.',
            ], 403);
        }

        try {
            $user = $request->user();
            $companyId = $user->company_id;
            
            if (!$this->hasPermission($request, 'can_manage_all_expenses')) {
                // Only allow filtering by user's company
                $companyId = $user->company_id;
            } else if ($request->filled('company_id')) {
                $companyId = $request->input('company_id');
            }

            // Base query
            $query = Expense::where('company_id', $companyId);

            // Date range filtering
            if ($request->filled('start_date') && $request->filled('end_date')) {
                $query->whereBetween('expense_date', [
                    $request->input('start_date'),
                    $request->input('end_date')
                ]);
            } else if ($request->filled('start_date')) {
                $query->where('expense_date', '>=', $request->input('start_date'));
            } else if ($request->filled('end_date')) {
                $query->where('expense_date', '<=', $request->input('end_date'));
            } else {
                // Default to current month if no dates provided
                $query->whereMonth('expense_date', now()->month)
                      ->whereYear('expense_date', now()->year);
            }

            // Store filtering
            if ($request->filled('store_id')) {
                $query->where('store_id', $request->input('store_id'));
            }

            // Get total by status
            $totalByStatus = $query->select('status', DB::raw('SUM(amount) as total'))
                ->groupBy('status')
                ->get()
                ->pluck('total', 'status')
                ->toArray();

            // Get total by category
            $totalByCategory = $query->select('category_id', DB::raw('SUM(amount) as total'))
                ->groupBy('category_id')
                ->get()
                ->map(function ($item) {
                    $category = ExpenseCategory::find($item->category_id);
                    return [
                        'category_id' => $item->category_id,
                        'category_name' => $category ? $category->name : 'Unknown',
                        'category_color' => $category ? $category->color : '#6B7280',
                        'total' => (float) $item->total,
                    ];
                });

            // Get total by payment method
            $totalByPaymentMethod = $query->select('payment_method', DB::raw('SUM(amount) as total'))
                ->groupBy('payment_method')
                ->get()
                ->pluck('total', 'payment_method')
                ->toArray();

            // Get expense trend (by month)
            $trend = [];
            if ($request->filled('trend_months') && $request->input('trend_months') > 0) {
                $months = min(intval($request->input('trend_months')), 12);
                $startDate = now()->subMonths($months)->startOfMonth();
                $endDate = now()->endOfMonth();

                $monthlyTotals = Expense::where('company_id', $companyId)
                    ->whereBetween('expense_date', [$startDate, $endDate])
                    ->select(
                        DB::raw('YEAR(expense_date) as year'),
                        DB::raw('MONTH(expense_date) as month'),
                        DB::raw('SUM(amount) as total')
                    )
                    ->groupBy('year', 'month')
                    ->orderBy('year')
                    ->orderBy('month')
                    ->get();

                foreach ($monthlyTotals as $monthTotal) {
                    $monthName = date('F', mktime(0, 0, 0, $monthTotal->month, 1));
                    $trend[] = [
                        'year' => $monthTotal->year,
                        'month' => $monthTotal->month,
                        'month_name' => $monthName,
                        'total' => (float) $monthTotal->total,
                    ];
                }
            }

            // Calculate overall totals
            $overallTotal = array_sum($totalByStatus);
            $approvedTotal = $totalByStatus['approved'] ?? 0;
            $pendingTotal = $totalByStatus['pending'] ?? 0;
            $paidTotal = $totalByStatus['paid'] ?? 0;
            $rejectedTotal = $totalByStatus['rejected'] ?? 0;

            // Get counts
            $counts = [
                'total' => $query->count(),
                'pending' => $query->where('status', 'pending')->count(),
                'approved' => $query->where('status', 'approved')->count(),
                'paid' => $query->where('status', 'paid')->count(),
                'rejected' => $query->where('status', 'rejected')->count(),
            ];

            return response()->json([
                'status' => 'success',
                'message' => 'Expense summary retrieved successfully.',
                'summary' => [
                    'total_amount' => $overallTotal,
                    'approved_amount' => $approvedTotal,
                    'pending_amount' => $pendingTotal,
                    'paid_amount' => $paidTotal,
                    'rejected_amount' => $rejectedTotal,
                    'counts' => $counts,
                    'by_category' => $totalByCategory,
                    'by_payment_method' => $totalByPaymentMethod,
                    'trend' => $trend,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve expense summary', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve expense summary: ' . $e->getMessage(),
            ], 500);
        }
    }
}
