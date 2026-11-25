<?php

namespace App\Services;

use App\Models\DeliveryNote;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

/**
 * An order's invoice is dated on its ORDER date: the invoice is a product of the order, so both show
 * the same day (decided 25/11/2026, replacing the 24/11 delivery-note dating). The delivery note
 * keeps its own date (the dispatch's), printed as "Delivery Note Date". The due date follows the
 * customer's Credit Period from the invoice date (Invoice::applyCreditPeriod), and the invoice's
 * sales entry in the books moves with it. Past sales included.
 */
class InvoiceDeliveryDateService
{
    /** The order's date: its order_date, else the day it was made. */
    public function orderDate(Order $order): ?string
    {
        return $order->order_date?->toDateString() ?? $order->created_at?->toDateString();
    }

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
     * Dates the order's invoice on the order date (and records the delivery note's own date beside it).
     * Returns true when the invoice date changed. $dryRun only reports. $includeEtims also re-dates an
     * invoice already sent to eTIMS (prod eTIMS is on DigiTax TEST; ask before doing it once live).
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
        $date = $this->orderDate($order);
        if (!$date) {
            return false;
        }
        $noteDate = $this->deliveryNoteDate($order);

        $changed = $invoice->invoice_date?->toDateString() !== $date;
        $noteChanged = $noteDate && $invoice->delivery_note_date?->toDateString() !== $noteDate;
        if (($changed || $noteChanged) && !$dryRun) {
            DB::transaction(function () use ($invoice, $date, $noteDate, $changed) {
                if ($changed) {
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
                    // Due date from the customer's Credit Period, and overdue or not from that.
                    $invoice->applyCreditPeriod();
                    if ((float) $invoice->balance_amount > 0.005 && in_array($invoice->status, ['sent', 'overdue', 'partially_paid'], true)) {
                        $invoice->status = $invoice->isOverdue()
                            ? 'overdue'
                            : ((float) $invoice->amount_paid + (float) $invoice->amount_credited > 0.005 ? 'partially_paid' : 'sent');
                    }
                }
                if ($noteDate) {
                    $invoice->delivery_note_date = $noteDate;
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
