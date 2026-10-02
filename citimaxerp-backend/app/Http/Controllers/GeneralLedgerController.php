<?php

namespace App\Http\Controllers;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\FinancialPeriod;
use App\Services\FinancialStatementService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GeneralLedgerController extends Controller
{
    protected FinancialStatementService $financialService;

    public function __construct(FinancialStatementService $financialService)
    {
        $this->middleware('auth:sanctum');
        $this->financialService = $financialService;
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

    protected function canManageCompany(Request $request, $companyId): bool
    {
        $user = $request->user();
        if ($this->hasPermission($request, 'can_manage_system')) {
            return true;
        }
        return $user->company_id === $companyId;
    }

    /**
     * Get General Ledger with all accounts and transactions
     */
    public function getGeneralLedger(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view general ledger.',
            ], 403);
        }

        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $accountId = $request->input('account_id');
        $accountType = $request->input('account_type');

        try {
            // Build query for journal entry items
            $query = JournalEntryItem::with([
                'journalEntry' => function ($q) use ($companyId) {
                    $q->where('company_id', $companyId)->where('status', 'posted');
                },
                'account'
            ])->whereHas('journalEntry', function ($q) use ($companyId) {
                $q->where('company_id', $companyId)->where('status', 'posted');
            });

            // Apply date filters
            if ($dateFrom) {
                $query->whereHas('journalEntry', fn($q) => $q->where('entry_date', '>=', $dateFrom));
            }
            if ($dateTo) {
                $query->whereHas('journalEntry', fn($q) => $q->where('entry_date', '<=', $dateTo));
            }

            // Apply account filters
            if ($accountId) {
                $query->where('account_id', $accountId);
            }
            if ($accountType) {
                $query->whereHas('account', fn($q) => $q->where('account_type', $accountType));
            }

            $items = $query->get()->sortBy(function ($item) {
                return $item->journalEntry->entry_date . $item->account->account_code;
            });

            // Group by account and calculate running balances
            $ledgerData = [];
            $accountRunningBalances = [];

            foreach ($items as $item) {
                $account = $item->account;
                $accId = $item->account_id;

                if (!isset($ledgerData[$accId])) {
                    // Calculate opening balance considering date filter
                    $openingBalance = $this->calculateOpeningBalance($account, $dateFrom);
                    
                    $ledgerData[$accId] = [
                        'account' => [
                            'id' => $account->id,
                            'code' => $account->account_code,
                            'name' => $account->account_name,
                            'type' => $account->account_type,
                            'subtype' => $account->account_subtype,
                            'normal_balance' => $this->hasDebitNormalBalance($account) ? 'debit' : 'credit',
                        ],
                        'opening_balance' => round($openingBalance, 2),
                        'transactions' => [],
                        'totals' => [
                            'total_debits' => 0,
                            'total_credits' => 0,
                            'closing_balance' => $openingBalance,
                        ]
                    ];
                    $accountRunningBalances[$accId] = $openingBalance;
                }

                // Calculate running balance based on normal balance
                if ($this->hasDebitNormalBalance($account)) {
                    $accountRunningBalances[$accId] += $item->debit_amount - $item->credit_amount;
                } else {
                    $accountRunningBalances[$accId] += $item->credit_amount - $item->debit_amount;
                }

                $ledgerData[$accId]['transactions'][] = [
                    'id' => $item->id,
                    'journal_entry_id' => $item->journal_entry_id,
                    'date' => $item->journalEntry->entry_date,
                    'reference' => $item->journalEntry->reference,
                    'description' => $item->description ?: $item->journalEntry->description,
                    'entry_type' => $item->journalEntry->entry_type,
                    'debit_amount' => round((float) $item->debit_amount, 2),
                    'credit_amount' => round((float) $item->credit_amount, 2),
                    'running_balance' => round($accountRunningBalances[$accId], 2),
                ];

                $ledgerData[$accId]['totals']['total_debits'] += $item->debit_amount;
                $ledgerData[$accId]['totals']['total_credits'] += $item->credit_amount;
                $ledgerData[$accId]['totals']['closing_balance'] = round($accountRunningBalances[$accId], 2);
            }

            // Round totals
            foreach ($ledgerData as &$data) {
                $data['totals']['total_debits'] = round($data['totals']['total_debits'], 2);
                $data['totals']['total_credits'] = round($data['totals']['total_credits'], 2);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'General ledger retrieved successfully.',
                'data' => [
                    'ledger_data' => array_values($ledgerData),
                    'filters' => [
                        'date_from' => $dateFrom,
                        'date_to' => $dateTo,
                        'account_id' => $accountId,
                        'account_type' => $accountType,
                    ],
                    'summary' => [
                        'total_accounts' => count($ledgerData),
                        'total_transactions' => $items->count(),
                    ],
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('General Ledger retrieval error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve general ledger.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get Account Ledger for a specific account
     */
    public function getAccountLedger(Request $request, $accountId): JsonResponse
    {
        $user = $request->user();
        
        if (!$this->hasPermission($request, 'can_view_general_ledger')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view account ledger.',
            ], 403);
        }

        $account = ChartOfAccount::find($accountId);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this account ledger.',
            ], 403);
        }

        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        try {
            $ledger = $this->financialService
                ->forCompany($account->company_id)
                ->getAccountLedger($accountId, $dateFrom, $dateTo);

            return response()->json([
                'status' => 'success',
                'message' => 'Account ledger retrieved successfully.',
                'data' => $ledger,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Account Ledger retrieval error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve account ledger.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get Trial Balance
     */
    public function getTrialBalance(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$this->hasPermission($request, 'can_view_trial_balance')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view trial balance.',
            ], 403);
        }

        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this company\'s trial balance.',
            ], 403);
        }

        $asOfDate = $request->input('as_of_date', now()->toDateString());

        try {
            $trialBalance = $this->financialService
                ->forCompany($companyId)
                ->getTrialBalance($asOfDate);

            return response()->json([
                'status' => 'success',
                'message' => 'Trial balance retrieved successfully.',
                'data' => $trialBalance,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Trial Balance retrieval error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve trial balance.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get Account Balance
     */
    public function getAccountBalance(Request $request, $accountId): JsonResponse
    {
        $user = $request->user();
        
        if (!$this->hasPermission($request, 'can_view_general_ledger')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view account balance.',
            ], 403);
        }

        $account = ChartOfAccount::find($accountId);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this account balance.',
            ], 403);
        }

        $asOfDate = $request->input('as_of_date', now()->toDateString());

        try {
            $balance = $this->financialService
                ->forCompany($account->company_id)
                ->calculateAccountBalance($account, $asOfDate);

            return response()->json([
                'status' => 'success',
                'message' => 'Account balance retrieved successfully.',
                'data' => [
                    'account' => [
                        'id' => $account->id,
                        'code' => $account->account_code,
                        'name' => $account->account_name,
                        'type' => $account->account_type,
                        'subtype' => $account->account_subtype,
                        'normal_balance' => $this->hasDebitNormalBalance($account) ? 'debit' : 'credit',
                    ],
                    'balance' => round($balance, 2),
                    'as_of_date' => $asOfDate,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Account Balance retrieval error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve account balance.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get Account Types
     */
    public function getAccountTypes(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_general_ledger')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view account types.',
            ], 403);
        }

        $accountTypes = [
            'asset' => [
                'name' => 'Assets',
                'normal_balance' => 'debit',
                'subtypes' => [
                    'current_asset' => 'Current Assets',
                    'cash' => 'Cash & Cash Equivalents',
                    'bank' => 'Bank Accounts',
                    'receivables' => 'Receivables',
                    'inventory' => 'Inventory',
                    'fixed_asset' => 'Fixed Assets',
                    'property_plant_equipment' => 'Property, Plant & Equipment',
                    'other_asset' => 'Other Assets',
                ],
            ],
            'liability' => [
                'name' => 'Liabilities',
                'normal_balance' => 'credit',
                'subtypes' => [
                    'current_liability' => 'Current Liabilities',
                    'payables' => 'Payables',
                    'accruals' => 'Accruals',
                    'long_term_liability' => 'Long-Term Liabilities',
                    'long_term_debt' => 'Long-Term Debt',
                    'other_liability' => 'Other Liabilities',
                ],
            ],
            'equity' => [
                'name' => 'Equity',
                'normal_balance' => 'credit',
                'subtypes' => [
                    'owner_equity' => 'Owner\'s Equity',
                    'retained_earnings' => 'Retained Earnings',
                    'common_stock' => 'Common Stock',
                    'other_equity' => 'Other Equity',
                ],
            ],
            'income' => [
                'name' => 'Income/Revenue',
                'normal_balance' => 'credit',
                'subtypes' => [
                    'operating_income' => 'Operating Income',
                    'sales_revenue' => 'Sales Revenue',
                    'service_revenue' => 'Service Revenue',
                    'other_income' => 'Other Income',
                ],
            ],
            'expense' => [
                'name' => 'Expenses',
                'normal_balance' => 'debit',
                'subtypes' => [
                    'cost_of_goods_sold' => 'Cost of Goods Sold',
                    'operating_expense' => 'Operating Expenses',
                    'payroll_expense' => 'Payroll Expenses',
                    'administrative_expense' => 'Administrative Expenses',
                    'other_expense' => 'Other Expenses',
                ],
            ],
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Account types retrieved successfully.',
            'data' => $accountTypes,
        ], 200);
    }

    /**
     * Check if account has a debit normal balance
     */
    private function hasDebitNormalBalance(ChartOfAccount $account): bool
    {
        $name = strtolower($account->account_name);
        $isContra = str_contains($name, 'accumulated depreciation')
            || str_contains($name, 'allowance for')
            || str_contains($name, 'contra')
            || str_contains($name, 'discount on');
        
        if ($isContra) {
            return !in_array($account->account_type, ['asset', 'expense']);
        }
        return in_array($account->account_type, ['asset', 'expense']);
    }

    /**
     * Calculate opening balance for an account as of a specific date
     */
    private function calculateOpeningBalance(ChartOfAccount $account, ?string $beforeDate): float
    {
        $opening = (float) ($account->opening_balance ?? 0);
        
        if (!$beforeDate) {
            return $opening;
        }

        // Get all transactions before the specified date
        $totals = JournalEntryItem::where('account_id', $account->id)
            ->whereHas('journalEntry', function ($q) use ($account, $beforeDate) {
                $q->where('company_id', $account->company_id)
                  ->where('status', 'posted')
                  ->where('entry_date', '<', $beforeDate);
            })
            ->selectRaw('COALESCE(SUM(debit_amount), 0) as total_debits, COALESCE(SUM(credit_amount), 0) as total_credits')
            ->first();

        $debits = (float) ($totals->total_debits ?? 0);
        $credits = (float) ($totals->total_credits ?? 0);

        if ($this->hasDebitNormalBalance($account)) {
            return $opening + $debits - $credits;
        } else {
            return $opening + $credits - $debits;
        }
    }
}
