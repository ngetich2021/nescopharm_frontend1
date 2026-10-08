<?php

namespace App\Observers;

use App\Models\Company;
use App\Services\AccountingSetupService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * New companies get a working chart of accounts, settings and account
 * mappings immediately, so their first invoice already reaches the ledger.
 */
class CompanyAccountingObserver
{
    public function created(Company $company): void
    {
        DB::afterCommit(function () use ($company) {
            try {
                app(AccountingSetupService::class)->ensureCompanySetup($company->id);
            } catch (\Throwable $e) {
                Log::error('Accounting setup failed for new company', [
                    'company_id' => $company->id,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
