<?php

namespace App\Services;

use App\Models\CreditNote;
use App\Models\Invoice;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

/**
 * Applying a credit note to an invoice, and deleting one for good.
 *
 * Credit goes to the invoice's amount_credited (never amount_paid, which is money received),
 * so the invoice shows "Credited" and keeps the credit when its receipts are recounted. Each
 * application is noted on the credit note (metadata.applications) so it can be undone.
 */
class CreditNoteService
{
    /** Apply up to $amount of the note's remaining credit to the invoice. Returns what was applied. */
    public function apply(CreditNote $creditNote, Invoice $invoice, ?float $amount = null): float
    {
        $applyAmount = round(min(
            $amount ?? (float) $creditNote->balance_amount,
            (float) $creditNote->balance_amount,
            max(0, $invoice->outstanding()),
        ), 2);
        if ($applyAmount <= 0) {
            return 0;
        }

        DB::transaction(function () use ($creditNote, $invoice, $applyAmount) {
            $invoice->update(['amount_credited' => (float) $invoice->amount_credited + $applyAmount]);
            app(InvoicePaymentApplicationService::class)->syncOrderPaid($invoice);

            $applied = (float) $creditNote->amount_applied + $applyAmount;
            $remaining = (float) $creditNote->total_amount - $applied - (float) $creditNote->amount_refunded;
            $metadata = $creditNote->metadata ?? [];
            $metadata['applications'][] = [
                'invoice_id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'amount' => $applyAmount,
                'applied_at' => now()->toDateTimeString(),
            ];
            $creditNote->update([
                'amount_applied' => $applied,
                'balance_amount' => max(0, $remaining),
                'status' => $remaining <= 0.005 ? 'applied' : 'issued',
                'applied_at' => $remaining <= 0.005 ? now() : $creditNote->applied_at,
                'metadata' => $metadata,
            ]);
        });

        return $applyAmount;
    }

    /**
     * Delete a credit note whatever its status: the credit comes off the invoices it was applied
     * to, the stock it returned is taken back out, and its refunds and lines go with it. Its
     * ledger entries are reversed by LedgerSyncObserver.
     */
    public function delete(CreditNote $creditNote): void
    {
        DB::transaction(function () use ($creditNote) {
            $this->unapply($creditNote);
            $this->takeBackStock($creditNote);
            $creditNote->refunds()->delete();
            $creditNote->lineItems()->delete();
            $creditNote->delete();
        });
    }

    /** An invoice is going: credit that other notes applied to it goes back to those notes, unused. */
    public function releaseInvoice(Invoice $invoice): void
    {
        CreditNote::where('company_id', $invoice->company_id)
            ->where('customer_id', $invoice->customer_id)
            ->where('amount_applied', '>', 0)
            ->get()
            ->each(function (CreditNote $note) use ($invoice) {
                $applications = collect($note->metadata['applications'] ?? []);
                $released = (float) $applications->where('invoice_id', $invoice->id)->sum('amount');
                if ($released <= 0) {
                    return;
                }
                $applied = max(0, (float) $note->amount_applied - $released);
                $metadata = $note->metadata;
                $metadata['applications'] = $applications->where('invoice_id', '!=', $invoice->id)->values()->all();
                $note->update([
                    'amount_applied' => $applied,
                    'balance_amount' => (float) $note->total_amount - $applied - (float) $note->amount_refunded,
                    'status' => 'issued',
                    'applied_at' => null,
                    'metadata' => $metadata,
                ]);
            });
    }

    protected function unapply(CreditNote $creditNote): void
    {
        $applications = $creditNote->metadata['applications'] ?? [];
        if (!$applications && (float) $creditNote->amount_applied > 0 && $creditNote->invoice_id) {
            // Applied before applications were recorded: it went to its own invoice, added to amount_paid.
            $invoice = Invoice::find($creditNote->invoice_id);
            if ($invoice) {
                $invoice->update(['amount_paid' => max(0, (float) $invoice->amount_paid - (float) $creditNote->amount_applied)]);
                app(InvoicePaymentApplicationService::class)->syncOrderPaid($invoice);
            }
            return;
        }

        foreach (collect($applications)->groupBy('invoice_id') as $invoiceId => $rows) {
            $invoice = Invoice::find($invoiceId);
            if ($invoice) {
                $invoice->update(['amount_credited' => max(0, (float) $invoice->amount_credited - (float) $rows->sum('amount'))]);
                app(InvoicePaymentApplicationService::class)->syncOrderPaid($invoice);
            }
        }
    }

    // Undo the stock an issued credit note put back (CreditNoteController::restoreInventoryForCreditNoteLineItem).
    protected function takeBackStock(CreditNote $creditNote): void
    {
        $movements = InventoryMovement::where('reference_type', 'credit_note')
            ->where('reference_id', $creditNote->id)
            ->get();
        foreach ($movements as $movement) {
            $stock = $movement->variant_id
                ? ProductVariant::find($movement->variant_id)
                : Product::find($movement->product_id);
            if ($stock) {
                $stock->update(['stock_quantity' => (int) $stock->stock_quantity - (int) $movement->quantity]);
            }
            $movement->delete();
        }
    }
}
