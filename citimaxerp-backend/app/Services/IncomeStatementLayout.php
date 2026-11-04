<?php

namespace App\Services;

/**
 * Lays the ledger's income statement out as the company's full P&L: Revenue, Cost of Sales,
 * Operating Expenses, Non-Operating items, then Tax, with a subtotal after each.
 *
 * Accounts are placed on a line by their name, so it works on any chart of accounts: a new account
 * called "Insurance" lands on the insurance line without any setup. An account no line recognises
 * goes on its section's fallback line, so every shilling in the ledger is on the statement and the
 * bottom line always equals FinancialStatementService::getIncomeStatement's net income.
 */
class IncomeStatementLayout
{
    // Section => group title (null: none) => line key => label.
    protected const LAYOUT = [
        'revenue' => ['title' => '1. Revenue', 'groups' => [null => [
            'gross_sales' => 'Gross Sales / Invoiced Revenue',
            'sales_returns' => 'Sales Returns & Allowances',
            'discounts' => 'Early Payment Discounts / Cash Discounts Offered',
        ]]],
        'cost_of_sales' => ['title' => '2. Cost of Goods Sold (COGS) / Cost of Sales', 'groups' => [null => [
            'goods_sold' => 'Cost of Goods Sold (goods for resale)',
            'materials' => 'Raw Materials & Direct Supplies Consumed',
            'direct_labor' => 'Direct Labor & Assembly Wages',
            'overtime' => 'Overtime & Shift Differentials (Production)',
            'overhead' => 'Manufacturing Overhead & Shop-Floor Utilities',
            'freight_in' => 'Freight-In & Inbound Logistics Costs',
            'customs' => 'Customs Duties & Import Levies',
            'write_downs' => 'Inventory Write-downs, Shrinkage & Scrap Costs',
        ]]],
        'operating_expenses' => ['title' => '3. Operating Expenses (OPEX)', 'groups' => [
            'Selling & Marketing (S&M)' => [
                'commissions' => 'Sales Commissions & Bonuses',
                'advertising' => 'Advertising & Marketing Campaign Spend',
                'promotions' => 'Promotions, Trade Shows & Sponsorships',
                'freight_out' => 'Outbound Freight & Shipping to Customers',
            ],
            'General & Administrative (G&A)' => [
                'salaries' => 'Executive & Administrative Salaries & Benefits',
                'rent' => 'Office Rent, Building Lease & Facility Maintenance',
                'utilities' => 'Utilities (Electricity, Water, Waste Management)',
                'software' => 'Software Subscriptions, IT Hosting & Web Infrastructure',
                'professional' => 'Legal, Accounting & Consulting Fees',
                'office' => 'Office Supplies & Administrative Expenses',
                'insurance' => 'Insurance Premiums (General Liability, Property)',
                'travel' => 'Travel, Entertainment & Meals',
                'other_admin' => 'Other General & Administrative Expenses',
            ],
            'Research & Development (R&D)' => [
                'rnd_staff' => 'R&D Staff Salaries & Contractor Fees',
                'rnd_materials' => 'Prototyping, Testing Materials & Lab Supplies',
            ],
            'Non-Cash Operating Expenses' => [
                'depreciation' => 'Depreciation Expense (Equipment, Buildings, Vehicles)',
                'amortization' => 'Amortization Expense (Intangible Assets, Patents, Software)',
            ],
        ]],
        'non_operating' => ['title' => '4. Non-Operating Income & Expenses', 'groups' => [null => [
            'interest_income' => 'Interest Income (on Cash Balances & Investments)',
            'interest_expense' => 'Interest Expense (on Loans, Credit Lines, Leases)',
            'fx_realized' => 'Foreign Exchange (Fx) Realized Gains / Losses',
            'fx_unrealized' => 'Foreign Exchange (Fx) Unrealized Gains / Losses',
            'disposal' => 'Gain or Loss on Asset Disposal / Sale of Equipment',
            'bank_charges' => 'Bank Service Charges & Transaction Fees',
            'other_income' => 'Other Income',
            'other_non_operating' => 'Other Non-Operating Expenses',
        ]]],
        'tax' => ['title' => '5. Taxes & Net Profit', 'groups' => [null => [
            'income_tax' => 'Corporate Income Tax Provision',
            'deferred_tax' => 'Deferred Tax Expenses / Adjustments',
        ]]],
    ];

    // Fallback lines appear only when an account lands on them.
    protected const HIDDEN_WHEN_EMPTY = ['other_admin', 'other_income', 'other_non_operating'];

    // Most specific first: the first pattern to match an account's name takes it.
    protected const PATTERNS = [
        'deferred_tax' => '/deferred tax/i',
        'income_tax' => '/income tax|corporat\w* tax|tax provision|provision for tax/i',
        'depreciation' => '/depreciation/i',
        'amortization' => '/amorti[sz]/i',
        'fx_unrealized' => '/unreali[sz]ed/i',
        'fx_realized' => '/forex|foreign exchange|exchange (gain|loss|difference)|\bfx\b|\breali[sz]ed/i',
        'disposal' => '/disposal|sale of (asset|equipment)/i',
        'bank_charges' => '/bank (charge|fee|service)|transaction (fee|charge)/i',
        'rnd_staff' => '/(r&d|research).*(salar|staff|contract|wage)/i',
        'rnd_materials' => '/prototyp|lab suppl|testing material|research|r&d/i',
        'materials' => '/raw material|direct suppl|materials consumed/i',
        'direct_labor' => '/direct labou?r|assembly wage/i',
        'overtime' => '/overtime|shift differential/i',
        'overhead' => '/manufacturing|shop.?floor|factory/i',
        'freight_in' => '/freight.?in|inbound|carriage inward/i',
        'customs' => '/customs|import (dut|lev)|\bdut(y|ies)\b/i',
        'write_downs' => '/write.?(down|off)|shrinkage|scrap|stock loss|breakage|obsolescence/i',
        'commissions' => '/commission|sales bonus/i',
        'promotions' => '/promotion|trade show|sponsor/i',
        'advertising' => '/advertis|marketing/i',
        'freight_out' => '/freight|shipping|courier|delivery|transport|outbound/i',
        'travel' => '/travel|entertain|\bmeal|per diem|accommodation/i',
        'salaries' => '/salar|wage|paye|nssf|nhif|shif|housing levy|payroll|benefit/i',
        'rent' => '/\brent\b|lease|facilit|repair|maintenance|cleaning|hygiene/i',
        'utilities' => '/utilit|electric|\bwater\b|waste/i',
        'software' => '/software|subscription|hosting|\bIT\b|internet|web/i',
        'professional' => '/legal|audit|accounting|accountancy|consult|professional fee/i',
        'office' => '/office|stationery|printing/i',
        'insurance' => '/insurance/i',
    ];

    public function __construct(protected array $ledgerStatement)
    {
    }

    /** @param array $ledgerStatement FinancialStatementService::getIncomeStatement's result */
    public static function from(array $ledgerStatement): array
    {
        return (new self($ledgerStatement))->build();
    }

    protected function build(): array
    {
        $placed = $this->placeAccounts();

        $section = function (string $key) use ($placed) {
            $groups = [];
            $effect = 0.0;
            foreach (self::LAYOUT[$key]['groups'] as $title => $lines) {
                $rows = [];
                foreach ($lines as $lineKey => $label) {
                    $accounts = $placed[$lineKey] ?? [];
                    if (!$accounts && in_array($lineKey, self::HIDDEN_WHEN_EMPTY, true)) {
                        continue;
                    }
                    $rows[] = ['key' => $lineKey, 'label' => $label, 'effect' => round(array_sum(array_column($accounts, 'effect')), 2), 'accounts' => $accounts];
                }
                $groupEffect = array_sum(array_column($rows, 'effect'));
                $effect += $groupEffect;
                $groups[] = ['title' => $title ?: null, 'lines' => $rows, 'effect' => round($groupEffect, 2)];
            }

            return ['key' => $key, 'title' => self::LAYOUT[$key]['title'], 'groups' => $groups, 'effect' => round($effect, 2)];
        };

        $revenue = $section('revenue');
        $costOfSales = $section('cost_of_sales');
        $operating = $section('operating_expenses');
        $nonOperating = $section('non_operating');
        $tax = $section('tax');

        $netRevenue = $revenue['effect'];
        $grossProfit = round($netRevenue + $costOfSales['effect'], 2);
        $operatingIncome = round($grossProfit + $operating['effect'], 2);
        $beforeTax = round($operatingIncome + $nonOperating['effect'], 2);
        $netIncome = round($beforeTax + $tax['effect'], 2);

        // Costs read as positive figures in sections of costs; Revenue and Non-Operating show each
        // line's effect on profit, so a return or an interest charge reads as a deduction.
        return [
            'sections' => [
                $this->present($revenue, false, 'Net Revenue', $netRevenue),
                $this->present($costOfSales, true, 'Gross Profit', $grossProfit, 'Total Cost of Sales'),
                $this->present($operating, true, 'Operating Income / EBIT', $operatingIncome, 'Total Operating Expenses'),
                $this->present($nonOperating, false, 'Earnings Before Taxes (EBT)', $beforeTax),
                $this->present($tax, true, 'Net Income / Net Profit After Tax', $netIncome, 'Total Taxes'),
            ],
            'totals' => [
                'net_revenue' => $netRevenue,
                'gross_profit' => $grossProfit,
                'operating_income' => $operatingIncome,
                'earnings_before_tax' => $beforeTax,
                'net_income' => $netIncome,
            ],
            'notes' => $this->notes($netRevenue, -$costOfSales['effect'], $beforeTax, -$tax['effect']),
        ];
    }

    protected function placeAccounts(): array
    {
        $s = $this->ledgerStatement['sections'];
        $sources = [
            // [accounts, is income, line when no name matches]
            [$s['revenue']['accounts'], true, 'gross_sales'],
            [$s['other_income']['accounts'], true, 'other_income'],
            [$s['cost_of_goods_sold']['accounts'], false, 'goods_sold'],
            [$s['operating_expenses']['accounts'], false, 'other_admin'],
            [$s['other_expenses']['accounts'], false, 'other_non_operating'],
        ];

        $placed = [];
        foreach ($sources as [$accounts, $isIncome, $fallback]) {
            foreach ($accounts as $account) {
                $line = $this->lineFor($account['account_name'], $isIncome) ?? $fallback;
                $placed[$line][] = [
                    'code' => $account['account_code'],
                    'name' => $account['account_name'],
                    'effect' => $isIncome ? (float) $account['amount'] : -(float) $account['amount'],
                ];
            }
        }

        return $placed;
    }

    protected function lineFor(string $accountName, bool $isIncome): ?string
    {
        if (preg_match('/interest/i', $accountName)) {
            return $isIncome ? 'interest_income' : 'interest_expense';
        }
        if (preg_match('/discount/i', $accountName)) {
            return 'discounts';
        }
        if ($isIncome && preg_match('/return|allowance/i', $accountName)) {
            return 'sales_returns';
        }
        if (!$isIncome && preg_match('/sales return/i', $accountName)) {
            return 'sales_returns';
        }

        foreach (self::PATTERNS as $line => $pattern) {
            if (preg_match($pattern, $accountName)) {
                // An income account only sits on a line that can hold income.
                if ($isIncome && !in_array($line, ['fx_realized', 'fx_unrealized', 'disposal'], true)) {
                    continue;
                }

                return $line;
            }
        }

        return null;
    }

    protected function present(array $section, bool $costs, string $subtotalLabel, float $subtotal, ?string $totalLabel = null): array
    {
        $sign = $costs ? -1 : 1;
        $amount = fn (float $effect) => round($sign * $effect, 2) + 0.0;

        return [
            'key' => $section['key'],
            'title' => $section['title'],
            'groups' => array_map(fn ($group) => [
                'title' => $group['title'],
                'total' => $amount($group['effect']),
                'lines' => array_map(fn ($line) => [
                    'key' => $line['key'],
                    'label' => $line['label'],
                    'amount' => $amount($line['effect']),
                    'accounts' => array_map(fn ($a) => [
                        'code' => $a['code'],
                        'name' => $a['name'],
                        'amount' => $amount($a['effect']),
                    ], $line['accounts']),
                ], $group['lines']),
            ], $section['groups']),
            'total_label' => $totalLabel,
            'total' => $amount($section['effect']),
            'subtotal_label' => $subtotalLabel,
            'subtotal' => $subtotal,
        ];
    }

    /** What the reader must know before trusting the bottom line. */
    protected function notes(float $netRevenue, float $costOfSales, float $beforeTax, float $tax): array
    {
        $notes = [];
        if ($netRevenue > 0 && $costOfSales < $netRevenue * 0.1) {
            $share = round($costOfSales / $netRevenue * 100, 1);
            $notes[] = "Cost of Sales is only {$share}% of revenue, so profit is likely overstated. The ledger records the cost of goods when stock leaves on a dispatch, and sales brought across from the old system did not post one.";
        }
        if ($beforeTax > 0 && abs($tax) < 0.01) {
            $notes[] = 'No income tax is recorded for this period, so Net Profit is the same as Earnings Before Taxes.';
        }

        return $notes;
    }
}
