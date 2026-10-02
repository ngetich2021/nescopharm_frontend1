<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\FinancialPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Carbon\Carbon;

class FinancialStatementService
{
    protected string $companyId;
    protected ?string $asOfDate = null;
    protected ?string $dateFrom = null;
    protected ?string $dateTo = null;
    protected ?string $comparativeDateFrom = null;
    protected ?string $comparativeDateTo = null;
    protected Collection $accounts;
    protected array $accountBalances = [];

    /**
     * Set the company ID for all operations
     */
    public function forCompany(string $companyId): self
    {
        $this->companyId = $companyId;
        return $this;
    }

    /**
     * Set the as-of date for balance sheet reports
     */
    public function asOf(string $date): self
    {
        $this->asOfDate = $date;
        return $this;
    }

    /**
     * Set the date range for period-based reports
     */
    public function forPeriod(string $dateFrom, string $dateTo): self
    {
        $this->dateFrom = $dateFrom;
        $this->dateTo = $dateTo;
        return $this;
    }

    /**
     * Set comparative period for comparative reports
     */
    public function withComparativePeriod(string $dateFrom, string $dateTo): self
    {
        $this->comparativeDateFrom = $dateFrom;
        $this->comparativeDateTo = $dateTo;
        return $this;
    }

    /**
     * Load all active accounts for the company
     */
    protected function loadAccounts(): void
    {
        $this->accounts = ChartOfAccount::where('company_id', $this->companyId)
            ->whereRaw("is_active = true")
            ->orderBy('account_code')
            ->get();
    }

    /**
     * Check if an account is a contra account (opposite normal balance)
     */
    protected function isContraAccount(ChartOfAccount $account): bool
    {
        $name = strtolower($account->account_name);
        return str_contains($name, 'accumulated depreciation')
            || str_contains($name, 'allowance for')
            || str_contains($name, 'contra')
            || str_contains($name, 'discount on');
    }

    /**
     * Determine if account has a debit normal balance
     */
    protected function hasDebitNormalBalance(ChartOfAccount $account): bool
    {
        if ($this->isContraAccount($account)) {
            // Contra accounts have opposite normal balance
            return !in_array($account->account_type, ['asset', 'expense']);
        }
        return in_array($account->account_type, ['asset', 'expense']);
    }

    /**
     * Calculate the balance for a single account as of a specific date
     */
    public function calculateAccountBalance(ChartOfAccount $account, ?string $asOfDate = null): float
    {
        $date = $asOfDate ?? $this->asOfDate ?? now()->toDateString();
        
        // Get opening balance
        $opening = (float) ($account->opening_balance ?? 0);
        
        // Get journal entry totals
        $totals = JournalEntryItem::where('account_id', $account->id)
            ->whereHas('journalEntry', function ($q) use ($date) {
                $q->where('company_id', $this->companyId)
                  ->where('status', 'posted')
                  ->where('entry_date', '<=', $date);
            })
            ->selectRaw('COALESCE(SUM(debit_amount), 0) as total_debits, COALESCE(SUM(credit_amount), 0) as total_credits')
            ->first();

        $debits = (float) ($totals->total_debits ?? 0);
        $credits = (float) ($totals->total_credits ?? 0);

        // Calculate balance based on normal balance direction
        if ($this->hasDebitNormalBalance($account)) {
            return $opening + $debits - $credits;
        } else {
            return $opening + $credits - $debits;
        }
    }

    /**
     * Calculate account activity for a period (no opening balance)
     */
    public function calculateAccountActivity(ChartOfAccount $account, string $dateFrom, string $dateTo): float
    {
        $totals = JournalEntryItem::where('account_id', $account->id)
            ->whereHas('journalEntry', function ($q) use ($dateFrom, $dateTo) {
                $q->where('company_id', $this->companyId)
                  ->where('status', 'posted')
                  ->whereBetween('entry_date', [$dateFrom, $dateTo]);
            })
            ->selectRaw('COALESCE(SUM(debit_amount), 0) as total_debits, COALESCE(SUM(credit_amount), 0) as total_credits')
            ->first();

        $debits = (float) ($totals->total_debits ?? 0);
        $credits = (float) ($totals->total_credits ?? 0);

        // For income/revenue accounts, credits increase
        // For expense accounts, debits increase
        if ($account->account_type === 'income') {
            return $credits - $debits;
        } else {
            return $debits - $credits;
        }
    }

    /**
     * Get all account balances with details
     */
    protected function getAllAccountBalances(?string $asOfDate = null): array
    {
        $this->loadAccounts();
        $date = $asOfDate ?? $this->asOfDate ?? now()->toDateString();
        
        $balances = [];
        
        foreach ($this->accounts as $account) {
            $balance = $this->calculateAccountBalance($account, $date);
            
            $balances[$account->id] = [
                'id' => $account->id,
                'code' => $account->account_code,
                'name' => $account->account_name,
                'type' => $account->account_type,
                'subtype' => $account->account_subtype,
                'is_contra' => $this->isContraAccount($account),
                'has_debit_normal' => $this->hasDebitNormalBalance($account),
                'balance' => $balance,
            ];
        }
        
        return $balances;
    }

    // =========================================================================
    // TRIAL BALANCE
    // =========================================================================

    /**
     * Generate Trial Balance
     */
    public function getTrialBalance(?string $asOfDate = null): array
    {
        $date = $asOfDate ?? $this->asOfDate ?? now()->toDateString();
        $accountBalances = $this->getAllAccountBalances($date);
        
        $trialBalanceRows = [];
        $totalDebits = 0;
        $totalCredits = 0;

        foreach ($accountBalances as $acc) {
            if (abs($acc['balance']) < 0.01) continue;
            
            $debitBalance = 0;
            $creditBalance = 0;
            
            if ($acc['has_debit_normal']) {
                if ($acc['balance'] >= 0) {
                    $debitBalance = $acc['balance'];
                } else {
                    $creditBalance = abs($acc['balance']);
                }
            } else {
                if ($acc['balance'] >= 0) {
                    $creditBalance = $acc['balance'];
                } else {
                    $debitBalance = abs($acc['balance']);
                }
            }
            
            $trialBalanceRows[] = [
                'account_id' => $acc['id'],
                'account_code' => $acc['code'],
                'account_name' => $acc['name'],
                'account_type' => $acc['type'],
                'account_subtype' => $acc['subtype'],
                'debit_balance' => round($debitBalance, 2),
                'credit_balance' => round($creditBalance, 2),
            ];
            
            $totalDebits += $debitBalance;
            $totalCredits += $creditBalance;
        }

        return [
            'report_type' => 'trial_balance',
            'company_id' => $this->companyId,
            'as_of_date' => $date,
            'generated_at' => now()->toIso8601String(),
            'accounts' => $trialBalanceRows,
            'totals' => [
                'total_debits' => round($totalDebits, 2),
                'total_credits' => round($totalCredits, 2),
                'difference' => round($totalDebits - $totalCredits, 2),
                'is_balanced' => abs($totalDebits - $totalCredits) < 0.01,
            ],
        ];
    }

    // =========================================================================
    // INCOME STATEMENT
    // =========================================================================

    /**
     * Generate Income Statement (Profit & Loss)
     */
    public function getIncomeStatement(?string $dateFrom = null, ?string $dateTo = null): array
    {
        $from = $dateFrom ?? $this->dateFrom ?? now()->startOfYear()->toDateString();
        $to = $dateTo ?? $this->dateTo ?? now()->toDateString();
        
        $this->loadAccounts();
        
        // Initialize categories
        $revenue = [];
        $costOfGoodsSold = [];
        $operatingExpenses = [];
        $otherIncome = [];
        $otherExpenses = [];
        
        $totalRevenue = 0;
        $totalCOGS = 0;
        $totalOperatingExpenses = 0;
        $totalOtherIncome = 0;
        $totalOtherExpenses = 0;

        foreach ($this->accounts as $account) {
            $activity = $this->calculateAccountActivity($account, $from, $to);
            
            if (abs($activity) < 0.01) continue;
            
            $row = [
                'account_id' => $account->id,
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'amount' => round(abs($activity), 2),
            ];

            switch ($account->account_type) {
                case 'income':
                    if ($account->account_subtype === 'other_income') {
                        $otherIncome[] = $row;
                        $totalOtherIncome += abs($activity);
                    } else {
                        $revenue[] = $row;
                        $totalRevenue += abs($activity);
                    }
                    break;
                    
                case 'expense':
                    if ($account->account_subtype === 'cost_of_goods_sold') {
                        $costOfGoodsSold[] = $row;
                        $totalCOGS += abs($activity);
                    } elseif ($account->account_subtype === 'other_expense') {
                        $otherExpenses[] = $row;
                        $totalOtherExpenses += abs($activity);
                    } else {
                        $operatingExpenses[] = $row;
                        $totalOperatingExpenses += abs($activity);
                    }
                    break;
            }
        }

        $grossProfit = $totalRevenue - $totalCOGS;
        $operatingIncome = $grossProfit - $totalOperatingExpenses;
        $incomeBeforeTax = $operatingIncome + $totalOtherIncome - $totalOtherExpenses;
        $netIncome = $incomeBeforeTax; // Tax would be deducted here in a more complete implementation

        return [
            'report_type' => 'income_statement',
            'company_id' => $this->companyId,
            'period' => [
                'from' => $from,
                'to' => $to,
            ],
            'generated_at' => now()->toIso8601String(),
            'sections' => [
                'revenue' => [
                    'accounts' => $revenue,
                    'total' => round($totalRevenue, 2),
                ],
                'cost_of_goods_sold' => [
                    'accounts' => $costOfGoodsSold,
                    'total' => round($totalCOGS, 2),
                ],
                'gross_profit' => round($grossProfit, 2),
                'operating_expenses' => [
                    'accounts' => $operatingExpenses,
                    'total' => round($totalOperatingExpenses, 2),
                ],
                'operating_income' => round($operatingIncome, 2),
                'other_income' => [
                    'accounts' => $otherIncome,
                    'total' => round($totalOtherIncome, 2),
                ],
                'other_expenses' => [
                    'accounts' => $otherExpenses,
                    'total' => round($totalOtherExpenses, 2),
                ],
                'income_before_tax' => round($incomeBeforeTax, 2),
                'net_income' => round($netIncome, 2),
            ],
            'summary' => [
                'total_revenue' => round($totalRevenue + $totalOtherIncome, 2),
                'total_expenses' => round($totalCOGS + $totalOperatingExpenses + $totalOtherExpenses, 2),
                'net_income' => round($netIncome, 2),
                'gross_profit_margin' => $totalRevenue > 0 ? round(($grossProfit / $totalRevenue) * 100, 2) : 0,
                'operating_margin' => $totalRevenue > 0 ? round(($operatingIncome / $totalRevenue) * 100, 2) : 0,
                'net_profit_margin' => ($totalRevenue + $totalOtherIncome) > 0 
                    ? round(($netIncome / ($totalRevenue + $totalOtherIncome)) * 100, 2) 
                    : 0,
            ],
        ];
    }

    // =========================================================================
    // BALANCE SHEET
    // =========================================================================

    /**
     * Generate Balance Sheet
     */
    public function getBalanceSheet(?string $asOfDate = null): array
    {
        $date = $asOfDate ?? $this->asOfDate ?? now()->toDateString();
        
        // First get net income to add to equity
        $incomeStatement = $this->getIncomeStatement(
            Carbon::parse($date)->startOfYear()->toDateString(),
            $date
        );
        $netIncome = $incomeStatement['sections']['net_income'];
        
        $accountBalances = $this->getAllAccountBalances($date);
        
        // Initialize categories
        $currentAssets = [];
        $fixedAssets = [];
        $otherAssets = [];
        $currentLiabilities = [];
        $longTermLiabilities = [];
        $otherLiabilities = [];
        $equity = [];
        
        $totalCurrentAssets = 0;
        $totalFixedAssets = 0;
        $totalAccumDepreciation = 0;
        $totalOtherAssets = 0;
        $totalCurrentLiabilities = 0;
        $totalLongTermLiabilities = 0;
        $totalOtherLiabilities = 0;
        $totalEquity = 0;

        foreach ($accountBalances as $acc) {
            if (abs($acc['balance']) < 0.01) continue;
            
            $row = [
                'account_id' => $acc['id'],
                'account_code' => $acc['code'],
                'account_name' => $acc['name'],
                'is_contra' => $acc['is_contra'],
                'amount' => round($acc['balance'], 2),
            ];

            switch ($acc['type']) {
                case 'asset':
                    if (in_array($acc['subtype'], ['current_asset', 'cash', 'bank', 'receivables', 'inventory'])) {
                        $currentAssets[] = $row;
                        $totalCurrentAssets += $acc['balance'];
                    } elseif (in_array($acc['subtype'], ['fixed_asset', 'property_plant_equipment'])) {
                        if ($acc['is_contra']) {
                            $fixedAssets[] = $row;
                            $totalAccumDepreciation += $acc['balance'];
                        } else {
                            $fixedAssets[] = $row;
                            $totalFixedAssets += $acc['balance'];
                        }
                    } else {
                        $otherAssets[] = $row;
                        $totalOtherAssets += $acc['balance'];
                    }
                    break;
                    
                case 'liability':
                    if (in_array($acc['subtype'], ['current_liability', 'payables', 'accruals'])) {
                        $currentLiabilities[] = $row;
                        $totalCurrentLiabilities += $acc['balance'];
                    } elseif (in_array($acc['subtype'], ['long_term_liability', 'long_term_debt'])) {
                        $longTermLiabilities[] = $row;
                        $totalLongTermLiabilities += $acc['balance'];
                    } else {
                        $otherLiabilities[] = $row;
                        $totalOtherLiabilities += $acc['balance'];
                    }
                    break;
                    
                case 'equity':
                    $equity[] = $row;
                    $totalEquity += $acc['balance'];
                    break;
            }
        }

        // Add current period net income to equity section
        if (abs($netIncome) >= 0.01) {
            $equity[] = [
                'account_id' => null,
                'account_code' => 'NET_INCOME',
                'account_name' => 'Net Income (Current Period)',
                'is_contra' => $netIncome < 0,
                'amount' => round($netIncome, 2),
            ];
            $totalEquity += $netIncome;
        }

        $netFixedAssets = $totalFixedAssets - $totalAccumDepreciation;
        $totalAssets = $totalCurrentAssets + $netFixedAssets + $totalOtherAssets;
        $totalLiabilities = $totalCurrentLiabilities + $totalLongTermLiabilities + $totalOtherLiabilities;
        $totalLiabilitiesAndEquity = $totalLiabilities + $totalEquity;

        return [
            'report_type' => 'balance_sheet',
            'company_id' => $this->companyId,
            'as_of_date' => $date,
            'generated_at' => now()->toIso8601String(),
            'sections' => [
                'assets' => [
                    'current_assets' => [
                        'accounts' => $currentAssets,
                        'total' => round($totalCurrentAssets, 2),
                    ],
                    'fixed_assets' => [
                        'accounts' => $fixedAssets,
                        'total_gross' => round($totalFixedAssets, 2),
                        'accumulated_depreciation' => round($totalAccumDepreciation, 2),
                        'total_net' => round($netFixedAssets, 2),
                    ],
                    'other_assets' => [
                        'accounts' => $otherAssets,
                        'total' => round($totalOtherAssets, 2),
                    ],
                    'total_assets' => round($totalAssets, 2),
                ],
                'liabilities' => [
                    'current_liabilities' => [
                        'accounts' => $currentLiabilities,
                        'total' => round($totalCurrentLiabilities, 2),
                    ],
                    'long_term_liabilities' => [
                        'accounts' => $longTermLiabilities,
                        'total' => round($totalLongTermLiabilities, 2),
                    ],
                    'other_liabilities' => [
                        'accounts' => $otherLiabilities,
                        'total' => round($totalOtherLiabilities, 2),
                    ],
                    'total_liabilities' => round($totalLiabilities, 2),
                ],
                'equity' => [
                    'accounts' => $equity,
                    'total' => round($totalEquity, 2),
                ],
                'total_liabilities_and_equity' => round($totalLiabilitiesAndEquity, 2),
            ],
            'validation' => [
                'total_assets' => round($totalAssets, 2),
                'total_liabilities_and_equity' => round($totalLiabilitiesAndEquity, 2),
                'difference' => round($totalAssets - $totalLiabilitiesAndEquity, 2),
                'is_balanced' => abs($totalAssets - $totalLiabilitiesAndEquity) < 0.01,
            ],
        ];
    }

    // =========================================================================
    // CASH FLOW STATEMENT (Indirect Method)
    // =========================================================================

    /**
     * Generate Cash Flow Statement using the Indirect Method
     */
    public function getCashFlowStatement(?string $dateFrom = null, ?string $dateTo = null): array
    {
        $from = $dateFrom ?? $this->dateFrom ?? now()->startOfYear()->toDateString();
        $to = $dateTo ?? $this->dateTo ?? now()->toDateString();
        
        $this->loadAccounts();
        
        // Get net income from income statement
        $incomeStatement = $this->getIncomeStatement($from, $to);
        $netIncome = $incomeStatement['sections']['net_income'];
        
        // Get beginning and ending balances for working capital accounts
        $fromDate = Carbon::parse($from)->subDay()->toDateString();
        
        // Initialize categories
        $operatingAdjustments = [];
        $workingCapitalChanges = [];
        $investingActivities = [];
        $financingActivities = [];
        
        $totalOperatingAdjustments = 0;
        $totalWorkingCapitalChanges = 0;
        $totalInvestingActivities = 0;
        $totalFinancingActivities = 0;

        foreach ($this->accounts as $account) {
            $beginningBalance = $this->calculateAccountBalance($account, $fromDate);
            $endingBalance = $this->calculateAccountBalance($account, $to);
            $change = $endingBalance - $beginningBalance;
            
            if (abs($change) < 0.01) continue;
            
            $row = [
                'account_id' => $account->id,
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'beginning_balance' => round($beginningBalance, 2),
                'ending_balance' => round($endingBalance, 2),
                'change' => round($change, 2),
            ];

            switch ($account->account_type) {
                case 'asset':
                    // Non-cash adjustments (Depreciation)
                    if ($this->isContraAccount($account) && str_contains(strtolower($account->account_name), 'depreciation')) {
                        $row['cash_effect'] = round($change, 2); // Add back depreciation
                        $operatingAdjustments[] = $row;
                        $totalOperatingAdjustments += $change;
                    }
                    // Current assets (except cash) - changes affect operating cash flow
                    elseif (in_array($account->account_subtype, ['receivables', 'inventory', 'prepaid'])) {
                        // Increase in asset = use of cash (negative effect)
                        $row['cash_effect'] = round(-$change, 2);
                        $workingCapitalChanges[] = $row;
                        $totalWorkingCapitalChanges -= $change;
                    }
                    // Fixed assets - investing activities
                    elseif (in_array($account->account_subtype, ['fixed_asset', 'property_plant_equipment']) 
                            && !$this->isContraAccount($account)) {
                        $row['cash_effect'] = round(-$change, 2); // Purchase is outflow
                        $investingActivities[] = $row;
                        $totalInvestingActivities -= $change;
                    }
                    break;
                    
                case 'liability':
                    // Current liabilities - changes affect operating cash flow
                    if (in_array($account->account_subtype, ['current_liability', 'payables', 'accruals'])) {
                        // Increase in liability = source of cash (positive effect)
                        $row['cash_effect'] = round($change, 2);
                        $workingCapitalChanges[] = $row;
                        $totalWorkingCapitalChanges += $change;
                    }
                    // Long-term liabilities - financing activities
                    elseif (in_array($account->account_subtype, ['long_term_liability', 'long_term_debt'])) {
                        $row['cash_effect'] = round($change, 2);
                        $financingActivities[] = $row;
                        $totalFinancingActivities += $change;
                    }
                    break;
                    
                case 'equity':
                    // Equity changes (except retained earnings from net income) - financing
                    if (!str_contains(strtolower($account->account_name), 'retained')) {
                        $row['cash_effect'] = round($change, 2);
                        $financingActivities[] = $row;
                        $totalFinancingActivities += $change;
                    }
                    break;
            }
        }

        // Calculate cash from operating activities
        $netCashFromOperating = $netIncome + $totalOperatingAdjustments + $totalWorkingCapitalChanges;
        $netCashFlow = $netCashFromOperating + $totalInvestingActivities + $totalFinancingActivities;
        
        // Get beginning and ending cash balances
        // Identify cash accounts by code pattern or name
        $cashAccounts = $this->accounts->filter(function ($acc) {
            $name = strtolower($acc->account_name);
            $code = $acc->account_code;
            
            // Check by name patterns
            $isCashByName = str_contains($name, 'cash') 
                || str_contains($name, 'bank') 
                || str_contains($name, 'checking')
                || str_contains($name, 'savings')
                || str_contains($name, 'm-pesa')
                || str_contains($name, 'mpesa')
                || str_contains($name, 'float');
            
            // Check by code pattern (typically 1xxx for cash/bank in standard COA)
            $isCashByCode = preg_match('/^1[0-1][0-9]{2}$/', $code);
            
            // Check by subtype
            $isCashBySubtype = in_array($acc->account_subtype, ['cash', 'bank']);
            
            return ($isCashByName || $isCashByCode || $isCashBySubtype) 
                && $acc->account_type === 'asset'
                && !$this->isContraAccount($acc);
        });
        
        $beginningCash = 0;
        $endingCash = 0;
        foreach ($cashAccounts as $cashAccount) {
            $beginningCash += $this->calculateAccountBalance($cashAccount, $fromDate);
            $endingCash += $this->calculateAccountBalance($cashAccount, $to);
        }

        return [
            'report_type' => 'cash_flow_statement',
            'company_id' => $this->companyId,
            'period' => [
                'from' => $from,
                'to' => $to,
            ],
            'generated_at' => now()->toIso8601String(),
            'sections' => [
                'operating_activities' => [
                    'net_income' => round($netIncome, 2),
                    'adjustments' => [
                        'items' => $operatingAdjustments,
                        'total' => round($totalOperatingAdjustments, 2),
                    ],
                    'working_capital_changes' => [
                        'items' => $workingCapitalChanges,
                        'total' => round($totalWorkingCapitalChanges, 2),
                    ],
                    'net_cash_from_operating' => round($netCashFromOperating, 2),
                ],
                'investing_activities' => [
                    'items' => $investingActivities,
                    'net_cash_from_investing' => round($totalInvestingActivities, 2),
                ],
                'financing_activities' => [
                    'items' => $financingActivities,
                    'net_cash_from_financing' => round($totalFinancingActivities, 2),
                ],
            ],
            'summary' => [
                'net_increase_in_cash' => round($netCashFlow, 2),
                'beginning_cash_balance' => round($beginningCash, 2),
                'ending_cash_balance' => round($endingCash, 2),
                'calculated_ending_cash' => round($beginningCash + $netCashFlow, 2),
                'reconciliation_difference' => round($endingCash - ($beginningCash + $netCashFlow), 2),
            ],
        ];
    }

    // =========================================================================
    // GENERAL LEDGER
    // =========================================================================

    /**
     * Get account ledger with transactions
     */
    public function getAccountLedger(string $accountId, ?string $dateFrom = null, ?string $dateTo = null): array
    {
        $account = ChartOfAccount::find($accountId);
        if (!$account || $account->company_id !== $this->companyId) {
            throw new \InvalidArgumentException('Account not found or does not belong to this company');
        }

        $query = JournalEntryItem::with(['journalEntry'])
            ->where('account_id', $accountId)
            ->whereHas('journalEntry', function ($q) {
                $q->where('company_id', $this->companyId)->where('status', 'posted');
            });

        if ($dateFrom) {
            $query->whereHas('journalEntry', fn($q) => $q->where('entry_date', '>=', $dateFrom));
        }

        if ($dateTo) {
            $query->whereHas('journalEntry', fn($q) => $q->where('entry_date', '<=', $dateTo));
        }

        $items = $query->get()->sortBy(fn($item) => $item->journalEntry->entry_date);

        // Calculate opening balance (before dateFrom if specified)
        $openingBalance = (float) ($account->opening_balance ?? 0);
        if ($dateFrom) {
            $priorDebits = JournalEntryItem::where('account_id', $accountId)
                ->whereHas('journalEntry', fn($q) => $q->where('status', 'posted')->where('entry_date', '<', $dateFrom))
                ->sum('debit_amount');
            $priorCredits = JournalEntryItem::where('account_id', $accountId)
                ->whereHas('journalEntry', fn($q) => $q->where('status', 'posted')->where('entry_date', '<', $dateFrom))
                ->sum('credit_amount');
            
            if ($this->hasDebitNormalBalance($account)) {
                $openingBalance += $priorDebits - $priorCredits;
            } else {
                $openingBalance += $priorCredits - $priorDebits;
            }
        }

        $runningBalance = $openingBalance;
        $transactions = [];
        $totalDebits = 0;
        $totalCredits = 0;

        foreach ($items as $item) {
            // Update running balance
            if ($this->hasDebitNormalBalance($account)) {
                $runningBalance += $item->debit_amount - $item->credit_amount;
            } else {
                $runningBalance += $item->credit_amount - $item->debit_amount;
            }

            $transactions[] = [
                'id' => $item->id,
                'date' => $item->journalEntry->entry_date,
                'reference' => $item->journalEntry->reference,
                'description' => $item->description ?: $item->journalEntry->description,
                'entry_type' => $item->journalEntry->entry_type,
                'debit_amount' => round((float) $item->debit_amount, 2),
                'credit_amount' => round((float) $item->credit_amount, 2),
                'running_balance' => round($runningBalance, 2),
            ];

            $totalDebits += $item->debit_amount;
            $totalCredits += $item->credit_amount;
        }

        return [
            'account' => [
                'id' => $account->id,
                'code' => $account->account_code,
                'name' => $account->account_name,
                'type' => $account->account_type,
                'subtype' => $account->account_subtype,
                'normal_balance' => $this->hasDebitNormalBalance($account) ? 'debit' : 'credit',
            ],
            'period' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
            'opening_balance' => round($openingBalance, 2),
            'transactions' => $transactions,
            'totals' => [
                'total_debits' => round($totalDebits, 2),
                'total_credits' => round($totalCredits, 2),
                'net_change' => round($totalDebits - $totalCredits, 2),
            ],
            'closing_balance' => round($runningBalance, 2),
        ];
    }

    // =========================================================================
    // FINANCIAL RATIOS
    // =========================================================================

    /**
     * Calculate comprehensive financial ratios
     */
    public function getFinancialRatios(?string $asOfDate = null, ?string $periodFrom = null): array
    {
        $date = $asOfDate ?? $this->asOfDate ?? now()->toDateString();
        $from = $periodFrom ?? Carbon::parse($date)->startOfYear()->toDateString();
        
        $balanceSheet = $this->getBalanceSheet($date);
        $incomeStatement = $this->getIncomeStatement($from, $date);
        
        // Extract key figures
        $totalAssets = $balanceSheet['sections']['assets']['total_assets'];
        $currentAssets = $balanceSheet['sections']['assets']['current_assets']['total'];
        $fixedAssets = $balanceSheet['sections']['assets']['fixed_assets']['total_net'];
        $totalLiabilities = $balanceSheet['sections']['liabilities']['total_liabilities'];
        $currentLiabilities = $balanceSheet['sections']['liabilities']['current_liabilities']['total'];
        $totalEquity = $balanceSheet['sections']['equity']['total'];
        
        $totalRevenue = $incomeStatement['sections']['revenue']['total'];
        $grossProfit = $incomeStatement['sections']['gross_profit'];
        $operatingIncome = $incomeStatement['sections']['operating_income'];
        $netIncome = $incomeStatement['sections']['net_income'];
        $totalExpenses = $incomeStatement['summary']['total_expenses'];
        
        // Get inventory and receivables for turnover ratios
        $inventory = 0;
        $receivables = 0;
        foreach ($balanceSheet['sections']['assets']['current_assets']['accounts'] as $acc) {
            if (str_contains(strtolower($acc['account_name']), 'inventory')) {
                $inventory += $acc['amount'];
            }
            if (str_contains(strtolower($acc['account_name']), 'receivable')) {
                $receivables += $acc['amount'];
            }
        }

        return [
            'report_type' => 'financial_ratios',
            'company_id' => $this->companyId,
            'as_of_date' => $date,
            'period_from' => $from,
            'generated_at' => now()->toIso8601String(),
            'ratios' => [
                'liquidity' => [
                    'current_ratio' => $currentLiabilities > 0 
                        ? round($currentAssets / $currentLiabilities, 2) 
                        : null,
                    'quick_ratio' => $currentLiabilities > 0 
                        ? round(($currentAssets - $inventory) / $currentLiabilities, 2) 
                        : null,
                    'cash_ratio' => $currentLiabilities > 0 
                        ? round(($currentAssets - $inventory - $receivables) / $currentLiabilities, 2) 
                        : null,
                    'working_capital' => round($currentAssets - $currentLiabilities, 2),
                ],
                'leverage' => [
                    'debt_to_equity' => $totalEquity > 0 
                        ? round($totalLiabilities / $totalEquity, 2) 
                        : null,
                    'debt_to_assets' => $totalAssets > 0 
                        ? round($totalLiabilities / $totalAssets, 2) 
                        : null,
                    'equity_ratio' => $totalAssets > 0 
                        ? round($totalEquity / $totalAssets, 2) 
                        : null,
                    'debt_ratio' => $totalAssets > 0 
                        ? round($totalLiabilities / $totalAssets * 100, 2) 
                        : null,
                ],
                'profitability' => [
                    'gross_profit_margin' => $totalRevenue > 0 
                        ? round(($grossProfit / $totalRevenue) * 100, 2) 
                        : null,
                    'operating_margin' => $totalRevenue > 0 
                        ? round(($operatingIncome / $totalRevenue) * 100, 2) 
                        : null,
                    'net_profit_margin' => $totalRevenue > 0 
                        ? round(($netIncome / $totalRevenue) * 100, 2) 
                        : null,
                    'return_on_assets' => $totalAssets > 0 
                        ? round(($netIncome / $totalAssets) * 100, 2) 
                        : null,
                    'return_on_equity' => $totalEquity > 0 
                        ? round(($netIncome / $totalEquity) * 100, 2) 
                        : null,
                ],
                'efficiency' => [
                    'asset_turnover' => $totalAssets > 0 
                        ? round($totalRevenue / $totalAssets, 2) 
                        : null,
                    'inventory_turnover' => $inventory > 0 
                        ? round($totalRevenue / $inventory, 2) 
                        : null,
                    'receivables_turnover' => $receivables > 0 
                        ? round($totalRevenue / $receivables, 2) 
                        : null,
                    'days_sales_outstanding' => $totalRevenue > 0 && $receivables > 0
                        ? round(($receivables / $totalRevenue) * 365, 0) 
                        : null,
                    'days_inventory_outstanding' => $totalRevenue > 0 && $inventory > 0
                        ? round(($inventory / $totalRevenue) * 365, 0) 
                        : null,
                ],
            ],
            'base_amounts' => [
                'total_assets' => round($totalAssets, 2),
                'current_assets' => round($currentAssets, 2),
                'total_liabilities' => round($totalLiabilities, 2),
                'current_liabilities' => round($currentLiabilities, 2),
                'total_equity' => round($totalEquity, 2),
                'total_revenue' => round($totalRevenue, 2),
                'gross_profit' => round($grossProfit, 2),
                'operating_income' => round($operatingIncome, 2),
                'net_income' => round($netIncome, 2),
                'inventory' => round($inventory, 2),
                'receivables' => round($receivables, 2),
            ],
        ];
    }

    // =========================================================================
    // COMPARATIVE REPORTS
    // =========================================================================

    /**
     * Generate comparative income statement
     */
    public function getComparativeIncomeStatement(
        string $currentFrom, 
        string $currentTo, 
        string $priorFrom, 
        string $priorTo
    ): array {
        $current = $this->getIncomeStatement($currentFrom, $currentTo);
        $prior = $this->getIncomeStatement($priorFrom, $priorTo);
        
        $calculateVariance = function($currentVal, $priorVal) {
            $change = $currentVal - $priorVal;
            $percentChange = $priorVal != 0 ? round(($change / abs($priorVal)) * 100, 2) : null;
            return [
                'change' => round($change, 2),
                'percent_change' => $percentChange,
            ];
        };

        return [
            'report_type' => 'comparative_income_statement',
            'company_id' => $this->companyId,
            'current_period' => ['from' => $currentFrom, 'to' => $currentTo],
            'prior_period' => ['from' => $priorFrom, 'to' => $priorTo],
            'generated_at' => now()->toIso8601String(),
            'comparison' => [
                'total_revenue' => [
                    'current' => $current['sections']['revenue']['total'],
                    'prior' => $prior['sections']['revenue']['total'],
                    'variance' => $calculateVariance(
                        $current['sections']['revenue']['total'],
                        $prior['sections']['revenue']['total']
                    ),
                ],
                'cost_of_goods_sold' => [
                    'current' => $current['sections']['cost_of_goods_sold']['total'],
                    'prior' => $prior['sections']['cost_of_goods_sold']['total'],
                    'variance' => $calculateVariance(
                        $current['sections']['cost_of_goods_sold']['total'],
                        $prior['sections']['cost_of_goods_sold']['total']
                    ),
                ],
                'gross_profit' => [
                    'current' => $current['sections']['gross_profit'],
                    'prior' => $prior['sections']['gross_profit'],
                    'variance' => $calculateVariance(
                        $current['sections']['gross_profit'],
                        $prior['sections']['gross_profit']
                    ),
                ],
                'operating_expenses' => [
                    'current' => $current['sections']['operating_expenses']['total'],
                    'prior' => $prior['sections']['operating_expenses']['total'],
                    'variance' => $calculateVariance(
                        $current['sections']['operating_expenses']['total'],
                        $prior['sections']['operating_expenses']['total']
                    ),
                ],
                'net_income' => [
                    'current' => $current['sections']['net_income'],
                    'prior' => $prior['sections']['net_income'],
                    'variance' => $calculateVariance(
                        $current['sections']['net_income'],
                        $prior['sections']['net_income']
                    ),
                ],
            ],
            'current_period_detail' => $current,
            'prior_period_detail' => $prior,
        ];
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Get the current financial period
     */
    public function getCurrentFinancialPeriod(): ?FinancialPeriod
    {
        return FinancialPeriod::where('company_id', $this->companyId)
            ->whereRaw("is_current = true")
            ->first();
    }

    /**
     * Validate that a date is within an open financial period
     */
    public function validateDateInOpenPeriod(string $date): bool
    {
        return FinancialPeriod::where('company_id', $this->companyId)
            ->where('status', 'open')
            ->where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->exists();
    }

    /**
     * Get all financial periods for the company
     */
    public function getFinancialPeriods(): Collection
    {
        return FinancialPeriod::where('company_id', $this->companyId)
            ->orderBy('start_date', 'desc')
            ->get();
    }
}
