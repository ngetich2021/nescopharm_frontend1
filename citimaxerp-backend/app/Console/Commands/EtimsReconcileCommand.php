<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\CompanyEtimsConfig;
use App\Models\Invoice;
use App\Services\TaxCompliance\Providers\Kenya\EtimsClient;
use Illuminate\Console\Command;

/**
 * Phase 8: backup restore reconciliation.
 *
 * When ops restores from a backup, our local view of eTIMS sync state may
 * diverge from KRA's. This command queries DigiTax for sales in a window
 * and marks local invoices accordingly. It does NOT submit anything - it
 * only reads. New submissions are blocked until ops confirms.
 *
 * Usage:
 *   php artisan etims:reconcile --company=<uuid> --since=2026-05-01 --until=2026-05-18
 */
class EtimsReconcileCommand extends Command
{
    protected $signature = 'etims:reconcile
        {--company= : Company UUID to reconcile (required)}
        {--since= : Start date Y-m-d (defaults to 7 days ago)}
        {--until= : End date Y-m-d (defaults to today)}
        {--dry-run : Show actions without writing}';

    protected $description = 'Reconcile local invoice eTIMS state against DigiTax records.';

    public function handle(EtimsClient $client): int
    {
        $companyId = $this->option('company');
        if (!$companyId) {
            $this->error('Pass --company=<uuid>');
            return self::INVALID;
        }
        $company = Company::find($companyId);
        if (!$company) {
            $this->error("Company {$companyId} not found.");
            return self::FAILURE;
        }
        $config = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->notSuperseded()
            ->first();
        if (!$config) {
            $this->error('No eTIMS config for this company.');
            return self::FAILURE;
        }

        $since = $this->option('since') ?: now()->subDays(7)->toDateString();
        $until = $this->option('until') ?: now()->toDateString();
        $dryRun = (bool) $this->option('dry-run');

        $this->info("Reconciling company {$companyId} from {$since} to {$until}" . ($dryRun ? ' (dry-run)' : ''));

        $response = $client->get($config, '/sales', [
            'since' => $since,
            'until' => $until,
            'limit' => 500,
        ], 'reconcile');

        if (!$response->successful()) {
            $this->error('DigiTax /sales query failed: HTTP ' . $response->status());
            return self::FAILURE;
        }

        $remoteSales = collect($response->json()['data'] ?? $response->json() ?? []);
        $this->info('Found ' . $remoteSales->count() . ' remote sales');

        $matched = 0;
        $marked = 0;
        $orphan = 0;

        foreach ($remoteSales as $remote) {
            $remoteSaleId = $remote['sale_id'] ?? $remote['id'] ?? null;
            $invoiceNumber = $remote['trader_invoice_number'] ?? null;
            if (!$remoteSaleId && !$invoiceNumber) {
                continue;
            }

            $invoice = Invoice::query()
                ->where('company_id', $companyId)
                ->when($remoteSaleId, fn($q) => $q->orWhere('etims_sale_id', $remoteSaleId))
                ->when($invoiceNumber, fn($q) => $q->orWhere('invoice_number', $invoiceNumber))
                ->first();

            if (!$invoice) {
                $orphan++;
                continue;
            }
            $matched++;

            $shouldMark = $invoice->etims_status !== 'completed' && (bool) ($remote['completed'] ?? true);
            if ($shouldMark) {
                if (!$dryRun) {
                    $invoice->update([
                        'etims_status' => 'completed',
                        'etims_sale_id' => $remoteSaleId ?? $invoice->etims_sale_id,
                        'etims_signature' => $remote['signature'] ?? $invoice->etims_signature,
                        'etims_qr_url' => $remote['qr_url'] ?? $invoice->etims_qr_url,
                        'etims_trader_invoice_number' => $remote['trader_invoice_number'] ?? $invoice->etims_trader_invoice_number,
                        'etims_synced_at' => now(),
                        'etims_lock_state' => null,
                    ]);
                }
                $marked++;
            }
        }

        $this->table(['Matched', 'Marked completed', 'Orphans at DigiTax'], [[$matched, $marked, $orphan]]);

        return self::SUCCESS;
    }
}
