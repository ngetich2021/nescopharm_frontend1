<?php

namespace App\Services;

use App\Models\DeliveryNote;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

/**
 * An order's invoice is dated on its delivery note date (decided 24/11/2026, NSK/0232: order
 * 04/06/2026, delivered 12/06/2026 - the invoice is dated 12/06/2026). The due date then follows
 * the customer's Credit Period from that date (Invoice::applyCreditPeriod), and the ledger entry
 * moves with it (LedgerSyncObserver). Past sales included.
 */
class InvoiceDeliveryDateService
{
    /**
     * The delivery note date of the order's latest dispatch: the dispatch's own date (what a past
     * sale's dispatch was entered with), else the day the delivery note or dispatch was made.
     */
    public function deliveryNoteDate(Order $order): ?string
    {
        $order->loadMissing('latestOrderDispatch');
        $dispatch = $order->latestOrderDispatch;
        if (!$dispatch) {
            return null;
        }
        $note = DeliveryNote::where('order_dispatch_id', $dispatch->id)->latest()->first();

        return $dispatch->dispatch_date?->toDateString()
            ?? $note?->created_at?->toDateString()
            ?? $dispatch->created_at?->toDateString();
    }

    /** Whether KRA already holds this invoice with its date; then the date can't move. */
    public function isLockedByEtims(Invoice $invoice): bool
    {
        return in_array($invoice->etims_status, ['submitted', 'completed'], true)
            || filled($invoice->etims_signature)
            || filled($invoice->etims_receipt_number);
    }

    /**
     * Dates the order's invoice on its delivery note date. Returns true when it changed.
     * $dryRun only reports. $includeEtims also re-dates an invoice already sent to eTIMS (done
     * once on 24/11/2026 for NSK/0288 and NSK/0460 while prod eTIMS was on DigiTax TEST).
     */
    public function align(Invoice $invoice, bool $dryRun = false, bool $includeEtims = false): bool
    {
        if (!$invoice->order_id || $invoice->type === 'credit_note' || (!$includeEtims && $this->isLockedByEtims($invoice))) {
            return false;
        }
        $order = $invoice->relationLoaded('order') ? $invoice->order : Order::find($invoice->order_id);
        if (!$order) {
            return false;
        }
        // Always the delivery note date, even one before the order date (the user's call, 24/11/2026).
        $date = $this->deliveryNoteDate($order);
        if (!$date) {
            return false;
        }

        $changed = $invoice->invoice_date?->toDateString() !== $date
            || $invoice->delivery_note_date?->toDateString() !== $date;
        if ($changed && !$dryRun) {
            DB::transaction(function () use ($invoice, $date) {
                // Only the date moves, so the invoice's own sales entry is re-dated in place. A
                // reverse-and-repost would date the reversal today and knock today's sales down.
                JournalEntry::where('company_id', $invoice->company_id)
                    ->where('source_type', Invoice::class)
                    ->where('source_id', $invoice->id)
                    ->where('status', 'posted')
                    ->get()
                    ->filter(fn (JournalEntry $e) => ($e->metadata['transaction_type'] ?? null) === 'sales_invoice')
                    ->each(fn (JournalEntry $e) => $e->forceFill(['entry_date' => $date])->saveQuietly());

                $invoice->invoice_date = $date;
                $invoice->delivery_note_date = $date;
                // Due date from the customer's Credit Period, and overdue or not from that.
                $invoice->applyCreditPeriod();
                if ((float) $invoice->balance_amount > 0.005 && in_array($invoice->status, ['sent', 'overdue', 'partially_paid'], true)) {
                    $invoice->status = $invoice->isOverdue()
                        ? 'overdue'
                        : ((float) $invoice->amount_paid + (float) $invoice->amount_credited > 0.005 ? 'partially_paid' : 'sent');
                }
                // Quietly: nothing else changed, so no ledger repost and no eTIMS submission.
                $invoice->saveQuietly();
            });
        }

        return $changed;
    }

    public function alignForOrder(Order $order): bool
    {
        $invoice = Invoice::where('order_id', $order->id)->orderBy('created_at')->first();

        return $invoice ? $this->align($invoice) : false;
    }
}
