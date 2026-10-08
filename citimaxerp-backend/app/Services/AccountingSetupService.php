<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\CompanyAccountMapping;
use App\Models\CompanyAccountingSettings;
use App\Models\ExpenseCategory;
use Database\Seeders\ChartOfAccountsSeeder;
use Illuminate\Support\Facades\DB;

/**
 * Brings a company's accounting configuration up to the point where every
 * business document can post: standard chart of accounts, default settings,
 * account mappings and expense-category mappings. Idempotent - it only adds
 * what is missing and never overwrites accounts or mappings a user set up.
 */
class AccountingSetupService
{
    /**
     * Expense category name keywords -> account code. First match wins.
     */
    protected const EXPENSE_CATEGORY_RULES = [
        ['salar|wage|allowance|casual|payroll', '5210'],
        ['food|meal|lunch|entertain|refreshment', '5350'],
        ['office|stationer|supplies|printing', '5250'],
        ['electric|power|kplc', '5241'],
        ['water', '5242'],
        ['internet|airtime|phone|telephone|communication', '5243'],
        ['utilit', '5240'],
        ['fuel|petrol|diesel', '5271'],
        ['vehicle|motor', '5272'],
        ['transport|logistic|delivery|freight|courier', '5270'],
        ['rent|lease', '5230'],
        ['government|tax|licen|permit|levy|county', '5330'],
        ['furniture|equipment|fixture|computer', '1540'],
        ['repair|maintenance', '5320'],
        ['market|brand|advert|promotion', '5260'],
        ['clean|hygiene|sanit', '5390'],
        ['security|guard', '5380'],
        ['insurance', '5280'],
        ['legal', '5291'],
        ['audit|accounting fee|professional|consult', '5290'],
        ['bank|charge|commission', '5300'],
        ['travel|accommodation|per diem', '5360'],
        ['training|seminar|course', '5370'],
        ['donation|contribution|charity', '5950'],
        ['penalt|fine', '5940'],
        ['medical', '5223'],
    ];

    public function ensureCompanySetup(string $companyId): array
    {
        $createdAccounts = $this->ensureStandardAccounts($companyId);
        CompanyAccountingSettings::getOrCreateDefaults($companyId);
        $mapped = CompanyAccountMapping::fillMissingFromChartOfAccounts($companyId);
        $categoryMappings = $this->ensureExpenseCategoryMappings($companyId);

        return [
            'accounts_created' => $createdAccounts,
            'mappings_added' => $mapped,
            'expense_category_mappings_added' => $categoryMappings,
        ];
    }

    /**
     * Create any standard accounts the company doesn't already have (matched
     * by account code), linking each to its parent.
     */
    public function ensureStandardAccounts(string $companyId): int
    {
        $standard = (new ChartOfAccountsSeeder())->getStandardChartOfAccounts();
        $created = 0;

        DB::transaction(function () use ($companyId, $standard, &$created) {
            $byCode = ChartOfAccount::where('company_id', $companyId)->get()->keyBy('account_code');

            foreach ($standard as $account) {
                if ($byCode->has($account['code'])) {
                    continue;
                }

                $parentId = null;
                if (!empty($account['parent_code']) && $byCode->has($account['parent_code'])) {
                    $parentId = $byCode->get($account['parent_code'])->id;
                }

                $new = ChartOfAccount::create([
                    'company_id' => $companyId,
                    'account_code' => $account['code'],
                    'account_name' => $account['name'],
                    'account_type' => $account['type'],
                    'account_subtype' => $account['subtype'],
                    'parent_id' => $parentId,
                    'description' => $account['description'] ?? null,
                    'is_active' => true,
                    'is_system_account' => $account['is_system'] ?? false,
                    'opening_balance' => 0,
                    'normal_balance' => $account['normal_balance'],
                    'tax_code' => $account['tax_code'] ?? null,
                ]);

                $byCode->put($account['code'], $new);
                $created++;
            }
        });

        return $created;
    }

    /**
     * Give each expense category its own expense account (via a context
     * mapping on miscellaneous_expense) so the income statement breaks
     * expenses down instead of lumping them into "Other Expenses".
     */
    public function ensureExpenseCategoryMappings(string $companyId): array
    {
        $accounts = ChartOfAccount::where('company_id', $companyId)->get()->keyBy('account_code');
        $existing = CompanyAccountMapping::where('company_id', $companyId)
            ->where('mapping_key', 'miscellaneous_expense')
            ->where('context_type', 'expense_category')
            ->pluck('context_id')
            ->flip();

        $added = [];
        foreach (ExpenseCategory::where('company_id', $companyId)->get() as $category) {
            if ($existing->has($category->id)) {
                continue;
            }
            $code = $this->accountCodeForCategory($category->name);
            if (!$code || !$accounts->has($code)) {
                continue;
            }
            CompanyAccountMapping::setMapping($companyId, 'miscellaneous_expense', $code, $accounts->get($code)->id, [
                'context_type' => 'expense_category',
                'context_id' => $category->id,
                'description' => "Expense category: {$category->name}",
            ]);
            $added[$category->name] = $code;
        }

        return $added;
    }

    public function accountCodeForCategory(string $name): ?string
    {
        $name = strtolower($name);
        foreach (self::EXPENSE_CATEGORY_RULES as [$pattern, $code]) {
            if (preg_match("/{$pattern}/", $name)) {
                return $code;
            }
        }
        return null;
    }
}
