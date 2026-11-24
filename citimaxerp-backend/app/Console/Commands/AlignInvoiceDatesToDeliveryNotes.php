<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\InvoiceDeliveryDateService;
use Illuminate\Console\Command;

/**
 * Dates every order invoice on its delivery note date (24/11/2026), past sales included. The due
 * date follows the customer's Credit Period and the ledger entry is re-dated on save. Invoices
 * KRA already holds (eTIMS) keep their date.
 */
class AlignInvoiceDatesToDeliveryNotes extends Command
{
    protected $signature = 'invoices:date-from-delivery-note {--dry-run : List what would change, change nothing}';
    protected $description = 'Date each order invoice on its delivery note date (due date follows the credit period)';

    public function handle(InvoiceDeliveryDateService $dates): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $changed = 0;
        $locked = 0;

        Invoice::whereNotNull('order_id')->where('type', 'sales')->with('order.latestOrderDispatch')
            ->orderBy('invoice_date')
            ->chunk(200, function ($invoices) use ($dates, $dryRun, &$changed, &$locked) {
                foreach ($invoices as $invoice) {
                    $before = [$invoice->invoice_date?->toDateString(), $invoice->due_date?->toDateString()];
                    $target = $invoice->order ? $dates->deliveryNoteDate($invoice->order) : null;
                    if ($target && $target !== $before[0] && $dates->isLockedByEtims($invoice)) {
                        $locked++;
                        $this->warn("{$invoice->invoice_number}: on eTIMS, kept at {$before[0]} (delivery note {$target})");
                        continue;
                    }
                    if ($target && $invoice->order->order_date && $target < $invoice->order->order_date->toDateString()) {
                        $this->warn("{$invoice->invoice_number}: delivery note {$target} is before the order ({$invoice->order->order_date->toDateString()}), kept at {$before[0]}");
                        continue;
                    }
                    if (!$dates->align($invoice, $dryRun)) {
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
