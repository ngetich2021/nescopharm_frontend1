<?php

namespace App\Console\Commands;

use App\Models\ProductReceipt;
use App\Services\SupplierBillService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Goods received before receipts raised supplier invoices: give each one its invoice (amount as the
 * receipt posted it, the receipt's reference as the supplier invoice no.). Receipts that already have
 * one, including bills brought across from the old system, are left alone.
 */
class SupplierInvoicesFromReceipts extends Command
{
    protected $signature = 'supplier-invoices:from-receipts {--dry-run}';

    protected $description = 'Create the supplier invoice for every goods receipt that has none';

    public function handle(SupplierBillService $bills): int
    {
        $covered = DB::table('accounts_payable')->whereRaw("metadata::jsonb->>'receipt_id' is not null")
            ->selectRaw("metadata::jsonb->>'receipt_id' as receipt_id")->pluck('receipt_id')->all();
        $receipts = ProductReceipt::whereNotNull('supplier_id')->whereNotIn('id', $covered)->orderBy('created_at')->get();
        $this->info($receipts->count() . ' goods receipt(s) without a supplier invoice');

        foreach ($receipts as $receipt) {
            $total = SupplierBillService::receiptTotal($receipt);
            $line = "{$receipt->product_receipt_number} " . $receipt->created_at?->toDateString() . ' KES ' . number_format($total, 2)
                . ' ref ' . ($receipt->reference_number ?: '-');
            if ($total <= 0) {
                $this->line("skip {$line} (nothing to bill)");
                continue;
            }
            if ($this->option('dry-run')) {
                $this->line("would create for {$line}");
                continue;
            }
            $bill = DB::transaction(fn () => $bills->syncFromReceipt($receipt));
            $this->line("{$bill?->invoice_number} for {$line}");
        }

        return self::SUCCESS;
    }
}
