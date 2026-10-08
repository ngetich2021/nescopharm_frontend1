<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\CreditNote;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\OrderDispatch;
use App\Models\Payment;
use App\Models\PaymentRefund;
use App\Models\PayrollRun;
use App\Models\ProductReceipt;
use App\Models\SupplierPayment;
use App\Services\AccountingSetupService;
use App\Services\LedgerPostingService;
use Illuminate\Console\Command;

/**
 * Replays every historical document through LedgerPostingService. Because the
 * service is idempotent this can be re-run at any time: documents already in
 * the ledger are left alone, changed ones are reversed and re-posted, and
 * anything that failed before (e.g. a missing mapping) is retried.
 */
class FinanceBackfill extends Command
{
    protected $signature = 'finance:backfill
        {--company= : Only this company id}
        {--dry-run : Report what would be posted without writing anything}';

    protected $description = 'Post journal entries for all historical invoices, receipts, expenses, purchases, dispatches, credit notes and payroll';

    /** Order matters only for readability of the ledger; balances are order-independent. */
    protected const DOCUMENTS = [
        'Goods received' => ProductReceipt::class,
        'Supplier payments' => SupplierPayment::class,
        'Invoices' => Invoice::class,
        'Customer receipts' => Payment::class,
        'Customer refunds' => PaymentRefund::class,
        'Credit notes' => CreditNote::class,
        'Dispatches (COGS)' => OrderDispatch::class,
        'Expenses' => Expense::class,
        'Payroll' => PayrollRun::class,
    ];

    public function handle(LedgerPostingService $ledger, AccountingSetupService $setup): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $companies = $this->option('company')
            ? Company::whereKey($this->option('company'))->get()
            : Company::whereRaw("is_active = true")->get();

        $failures = [];

        foreach ($companies as $company) {
            $this->info("== {$company->name}" . ($dryRun ? ' (dry run)' : ''));
            if (!$dryRun) {
                $setup->ensureCompanySetup($company->id);
                $ledger->forgetSettings($company->id);
            }

            $rows = [];
            foreach (self::DOCUMENTS as $label => $class) {
                $counts = ['post' => 0, 'repost' => 0, 'reverse' => 0, 'unchanged' => 0, 'nothing' => 0, 'skip' => 0, 'failed' => 0];

                $class::where('company_id', $company->id)->orderBy('created_at')->chunk(200, function ($docs) use ($ledger, $dryRun, &$counts, &$failures, $label) {
                    foreach ($docs as $doc) {
                        try {
                            $outcomes = $dryRun ? $ledger->planModel($doc) : $ledger->runModel($doc);
                            foreach ($outcomes as $outcome) {
                                $counts[$outcome]++;
                            }
                        } catch (\Throwable $e) {
                            $counts['failed']++;
                            $failures[] = [$label, $doc->getKey(), $e->getMessage()];
                        }
                    }
                });

                $rows[] = array_merge([$label], array_values($counts));
            }

            $this->table(['Document', 'Post', 'Repost', 'Reverse', 'Unchanged', 'Not postable', 'Skipped', 'Failed'], $rows);
        }

        if ($failures) {
            $this->warn(count($failures) . ' document(s) could not be posted:');
            foreach (array_slice($failures, 0, 30) as [$label, $id, $message]) {
                $this->line("  [{$label}] {$id}: {$message}");
            }
            return self::FAILURE;
        }

        $this->info($dryRun ? 'Dry run complete - nothing was written.' : 'Backfill complete.');
        return self::SUCCESS;
    }

}
