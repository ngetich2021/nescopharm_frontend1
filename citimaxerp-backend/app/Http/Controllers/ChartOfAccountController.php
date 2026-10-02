<?php

namespace App\Http\Controllers;

use App\Models\ChartOfAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChartOfAccountController extends Controller
{
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

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_chart_of_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view chart of accounts.',
            ], 403);
        }

        // Determine if requesting minimal list (default) or hierarchical view
        $view = $request->input('view', 'minimal'); // 'minimal' (default) or 'hierarchical'
        
        $query = ChartOfAccount::where('company_id', $user->company_id);

        // Filters
        if ($request->filled('account_type')) {
            $query->where('account_type', $request->input('account_type'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->input('is_active'));
        }

        if ($request->filled('parent_id')) {
            $query->where('parent_id', $request->input('parent_id'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('account_name', 'ilike', '%' . $search . '%')
                  ->orWhere('account_code', 'ilike', '%' . $search . '%')
                  ->orWhere('description', 'ilike', '%' . $search . '%');
            });
        }

        $accounts = $query->orderBy('account_code')->get();

        if ($view === 'hierarchical') {
            // Return hierarchical structure with nested children
            $response = $this->buildHierarchicalStructure($accounts);
            return response()->json([
                'status' => 'success',
                'message' => 'Chart of accounts retrieved successfully (hierarchical view).',
                'accounts' => $response,
            ], 200);
        }

        // Default: Minimal list view with only essential fields and no object duplication
        $minimalAccounts = $accounts->map(function ($account) {
            return [
                'id' => $account->id,
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'account_type' => $account->account_type,
                'account_subtype' => $account->account_subtype,
                'parent_id' => $account->parent_id,
                'is_active' => $account->is_active,
                'normal_balance' => $account->normal_balance,
                'level' => $account->level,
            ];
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Chart of accounts retrieved successfully.',
            'accounts' => $minimalAccounts,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        // Load with relationships for detailed view
        $account = ChartOfAccount::with(['parent', 'children', 'company'])->find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this account.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Account retrieved successfully.',
            'account' => $account,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'account_code' => 'required|string|max:20|unique:chart_of_accounts,account_code',
            'account_name' => 'required|string|max:255',
            'account_type' => 'required|in:asset,liability,equity,income,expense',
            'account_subtype' => 'required|in:current_asset,fixed_asset,other_asset,current_liability,long_term_liability,other_liability,owner_equity,retained_earnings,operating_income,other_income,cost_of_goods_sold,operating_expense,other_expense',
            'parent_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'is_system_account' => 'boolean',
            'opening_balance' => 'nullable|numeric',
            'normal_balance' => 'required|in:debit,credit',
            'tax_code' => 'nullable|string|max:10',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_chart_of_accounts')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create accounts.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $account = ChartOfAccount::create([
                'id' => (string) Str::uuid(),
                'company_id' => $request->input('company_id', $user->company_id),
                'account_code' => $request->input('account_code'),
                'account_name' => $request->input('account_name'),
                'account_type' => $request->input('account_type'),
                'account_subtype' => $request->input('account_subtype'),
                'parent_id' => $request->input('parent_id'),
                'description' => $request->input('description'),
                'is_active' => $request->input('is_active', true),
                'is_system_account' => $request->input('is_system_account', false),
                'opening_balance' => $request->input('opening_balance', 0),
                'normal_balance' => $request->input('normal_balance'),
                'tax_code' => $request->input('tax_code'),
            ]);

            DB::commit();

            $account->load(['parent', 'children', 'company']);

            return response()->json([
                'status' => 'success',
                'message' => 'Account created successfully.',
                'account' => $account,
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating chart of account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create account.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $account = ChartOfAccount::find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this account.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_chart_of_accounts')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit accounts.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'account_code' => 'sometimes|required|string|max:20|unique:chart_of_accounts,account_code,' . $id,
            'account_name' => 'sometimes|required|string|max:255',
            'account_type' => 'sometimes|required|in:asset,liability,equity,income,expense',
            'account_subtype' => 'sometimes|required|in:current_asset,fixed_asset,other_asset,current_liability,long_term_liability,other_liability,owner_equity,retained_earnings,operating_income,other_income,cost_of_goods_sold,operating_expense,other_expense',
            'parent_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'opening_balance' => 'nullable|numeric',
            'normal_balance' => 'sometimes|required|in:debit,credit',
            'tax_code' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();
            $account->update($request->only([
                'account_code', 'account_name', 'account_type', 'account_subtype',
                'parent_id', 'description', 'is_active', 'opening_balance',
                'normal_balance', 'tax_code'
            ]));

            DB::commit();

            $account->load(['parent', 'children', 'company']);

            return response()->json([
                'status' => 'success',
                'message' => 'Account updated successfully.',
                'account' => $account,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating chart of account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update account.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $account = ChartOfAccount::find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this account.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_delete_chart_of_accounts')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete accounts.',
            ], 403);
        }

        if ($account->is_system_account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete system accounts.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Check if account has children
            if ($account->children()->count() > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete account with child accounts.',
                ], 400);
            }

            // Check if account is used in journal entries
            if ($account->journalEntryItems()->count() > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete account with existing transactions.',
                ], 400);
            }

            $account->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Account deleted successfully.',
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting chart of account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete account.',
            ], 500);
        }
    }

    public function getAccountTypes(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_chart_of_accounts')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view account types.',
            ], 403);
        }

        $accountTypes = [
            'asset' => 'Asset',
            'liability' => 'Liability',
            'equity' => 'Equity',
            'income' => 'Income',
            'expense' => 'Expense',
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Account types retrieved successfully.',
            'account_types' => $accountTypes,
        ], 200);
    }

    public function getAccountsByType(Request $request, $type)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_chart_of_accounts')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view chart of accounts.',
            ], 403);
        }

        $validTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
        if (!in_array($type, $validTypes)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid account type.',
            ], 400);
        }

        $query = ChartOfAccount::where('account_type', $type)
                               ->where('is_active', true);

        // Always default to user's company
        $companyId = $user->company_id;
        
        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }
        
        $query->where('company_id', $companyId);

        $accounts = $query->orderBy('account_code')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Accounts retrieved successfully.',
            'accounts' => $accounts,
        ], 200);
    }

    public function getAccountSubtypes(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_chart_of_accounts')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view account subtypes.',
            ], 403);
        }

        $accountSubtypes = [
            'asset' => [
                'current_asset' => 'Current Asset',
                'fixed_asset' => 'Fixed Asset',
                'other_asset' => 'Other Asset',
            ],
            'liability' => [
                'current_liability' => 'Current Liability',
                'long_term_liability' => 'Long Term Liability',
                'other_liability' => 'Other Liability',
            ],
            'equity' => [
                'owner_equity' => 'Owner Equity',
                'retained_earnings' => 'Retained Earnings',
            ],
            'income' => [
                'operating_income' => 'Operating Income',
                'other_income' => 'Other Income',
            ],
            'expense' => [
                'cost_of_goods_sold' => 'Cost of Goods Sold',
                'operating_expense' => 'Operating Expense',
                'other_expense' => 'Other Expense',
            ],
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Account subtypes retrieved successfully.',
            'account_subtypes' => $accountSubtypes,
        ], 200);
    }

    /**
     * Build hierarchical structure for parent-child account relationships.
     * Prevents object duplication by nesting children within parents.
     */
    private function buildHierarchicalStructure($accounts)
    {
        $accountsById = $accounts->keyBy('id');
        $roots = [];

        foreach ($accounts as $account) {
            if (!$account->parent_id) {
                // Root level account
                $roots[$account->id] = $this->formatHierarchicalAccount($account, $accountsById);
            }
        }

        return array_values($roots);
    }

    /**
     * Format account with nested children for hierarchical view.
     */
    private function formatHierarchicalAccount($account, $accountsById)
    {
        return [
            'id' => $account->id,
            'account_code' => $account->account_code,
            'account_name' => $account->account_name,
            'account_type' => $account->account_type,
            'account_subtype' => $account->account_subtype,
            'parent_id' => $account->parent_id,
            'is_active' => $account->is_active,
            'normal_balance' => $account->normal_balance,
            'level' => $account->level,
            'children' => $this->getChildrenForHierarchy($account, $accountsById),
        ];
    }

    /**
     * Recursively get children for hierarchical structure.
     */
    private function getChildrenForHierarchy($account, $accountsById)
    {
        $children = [];
        
        foreach ($accountsById as $potentialChild) {
            if ($potentialChild->parent_id === $account->id) {
                $children[] = $this->formatHierarchicalAccount($potentialChild, $accountsById);
            }
        }

        return $children;
    }
}

