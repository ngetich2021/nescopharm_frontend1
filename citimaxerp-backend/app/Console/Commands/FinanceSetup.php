<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\AccountingSetupService;
use Illuminate\Console\Command;

class FinanceSetup extends Command
{
    protected $signature = 'finance:setup {--company= : Only this company id}';

    protected $description = 'Create any missing standard accounts, accounting settings and account mappings for each company (safe to re-run)';

    public function handle(AccountingSetupService $setup): int
    {
        $companies = $this->option('company')
            ? Company::whereKey($this->option('company'))->get()
            : Company::whereRaw("is_active = true")->get();

        foreach ($companies as $company) {
            $result = $setup->ensureCompanySetup($company->id);
            $this->info("{$company->name}");
            $this->line("  accounts created: {$result['accounts_created']}");
            $this->line('  mappings added: ' . (count($result['mappings_added']) ? implode(', ', array_keys($result['mappings_added'])) : 'none'));
            foreach ($result['expense_category_mappings_added'] as $category => $code) {
                $this->line("  expense category '{$category}' -> {$code}");
            }
        }

        return self::SUCCESS;
    }
}
