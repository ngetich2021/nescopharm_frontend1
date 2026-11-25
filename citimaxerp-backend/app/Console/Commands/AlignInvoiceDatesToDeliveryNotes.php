<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\InvoiceDeliveryDateService;
use Illuminate\Console\Command;

/**
 * Dates every order invoice on its order date (25/11/2026), past sales included; the delivery note
 * keeps its own date. The due date follows the customer's Credit Period and the ledger entry is
 * re-dated. Invoices KRA already holds (eTIMS) keep their date unless --include-etims.
 */
class AlignInvoiceDatesToDeliveryNotes extends Command
{
    protected $signature = 'invoices:date-from-order {--dry-run : List what would change, change nothing} {--include-etims : Also re-date invoices already sent to eTIMS}';
    protected $description = 'Date each order invoice on its order date (due date follows the credit period)';

    public function handle(InvoiceDeliveryDateService $dates): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $includeEtims = (bool) $this->option('include-etims');
        $changed = 0;
        $locked = 0;

        Invoice::whereNotNull('order_id')
            ->where(fn ($q) => $q->whereNull('type')->orWhereNotIn('type', ['proforma', 'credit_note']))
            ->with('order.latestOrderDispatch')
            // By id: paging in invoice_date order while changing invoice_date skipped rows.
            ->chunkById(200, function ($invoices) use ($dates, $dryRun, $includeEtims, &$changed, &$locked) {
                foreach ($invoices as $invoice) {
                    $before = [$invoice->invoice_date?->toDateString(), $invoice->due_date?->toDateString()];
                    $target = $invoice->order ? $dates->orderDate($invoice->order) : null;
                    if (!$includeEtims && $target && $target !== $before[0] && $dates->isLockedByEtims($invoice)) {
                        $locked++;
                        $this->warn("{$invoice->invoice_number}: on eTIMS, kept at {$before[0]} (order {$target}); --include-etims re-dates it");
                        continue;
                    }
                    if (!$dates->align($invoice, $dryRun, $includeEtims)) {
                        continue;
                    }
                    $changed++;
                    $after = $dryRun ? [$target, '?'] : [$invoice->invoice_date?->toDateString(), $invoice->due_date?->toDateString()];
                    $this->line("{$invoice->invoice_number}: dated {$before[0]} -> {$after[0]}, due {$before[1]} -> {$after[1]}");
                }
            });

        $this->info(($dryRun ? 'Would change' : 'Changed') . " {$changed} invoice(s); {$locked} kept because they are on eTIMS.");

        return self::SUCCESS;
    }
}
