<?php

namespace App\Services;

use App\Models\Cheque;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderDispatch;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Deletes an order for good together with its invoice, credit notes, receipts, cheques and
 * dispatch (stock goes back unless it's a past sale). Used by the Delete action and by the
 * clean-up of rejected and cancelled orders (`orders:purge-declined`).
 */
class OrderDeletionService
{
    // Why the order can't be deleted, or null when it can. Nothing stops it any more: its credit
    // notes, receipts, cheques and dispatch all go with it (old-system data is being re-entered).
    public function blocker(Order $order): ?string
    {
        return null;
    }

    public function delete(Order $order): void
    {
        $invoice = Invoice::where('order_id', $order->id)->first();

        DB::transaction(function () use ($order, $invoice) {
            if ($invoice) {
                // Credit notes raised on this invoice go; credit other notes applied here goes back to them.
                $creditNotes = app(CreditNoteService::class);
                CreditNote::where('invoice_id', $invoice->id)->get()->each(fn ($note) => $creditNotes->delete($note));
                $creditNotes->releaseInvoice($invoice);
                Cheque::where('invoice_id', $invoice->id)->delete();
            }

            // Receipts: one taken for this order alone goes with it. A receipt that also pays
            // other invoices (or was mapped here from elsewhere) stays, just no longer applied here.
            $allocations = $invoice ? PaymentAllocation::where('invoice_id', $invoice->id)->get() : collect();
            $paymentIds = $allocations->pluck('payment_id')
                ->merge(Payment::where('order_id', $order->id)->pluck('id'))
                ->merge($invoice ? Payment::where('invoice_id', $invoice->id)->pluck('id') : [])
                ->unique();
            $allocations->each->delete();
            Cheque::whereIn('payment_id', $paymentIds)->delete();
            if (Schema::hasTable('mpesa_transactions')) {
                // The M-Pesa record itself is the bank's; it just stops pointing at the deleted receipt.
                DB::table('mpesa_transactions')->whereIn('payment_id', $paymentIds)->update(['payment_id' => null]);
            }
            foreach (Payment::whereIn('id', $paymentIds)->get() as $payment) {
                $ownReceipt = $payment->order_id === $order->id || ($invoice && $payment->invoice_id === $invoice->id);
                if ($ownReceipt && !$payment->allocations()->exists()) {
                    $payment->delete();
                } else {
                    $payment->update([
                        'order_id' => $payment->order_id === $order->id ? null : $payment->order_id,
                        'invoice_id' => $invoice && $payment->invoice_id === $invoice->id ? null : $payment->invoice_id,
                    ]);
                }
            }

            if ($invoice) {
                $invoice->lineItems()->delete();
                $invoice->delete();
            }

            // Dispatch items, delivery notes and logistics rows cascade from the dispatch.
            OrderDispatch::where('order_id', $order->id)->get()->each->delete();
            // Older side tables, not on every database (the AccountsReceivable model's own table name is off).
            foreach (['accounts_receivable', 'debts'] as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->where('order_id', $order->id)->delete();
                }
            }

            app(OrderStockService::class)->restore($order->fresh(), "Order {$order->order_number} deleted");

            // Gone for good, so a re-import can reuse its number.
            $order->orderItems()->delete();
            $order->deliveryDetails()->delete();
            $order->forceDelete();
        });
    }
}
