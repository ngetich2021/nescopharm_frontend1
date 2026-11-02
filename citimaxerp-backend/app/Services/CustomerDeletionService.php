<?php

namespace App\Services;

use App\Models\Cheque;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\Quote;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Deletes a customer together with everything recorded for them: orders (each through
 * OrderDeletionService, so stock goes back unless it was a past sale), invoices, credit notes,
 * receipts, cheques, quotes and collection notes. Used by Delete Customer, for clearing data
 * that was entered for testing or migration.
 */
class CustomerDeletionService
{
    /** What goes with the customer, for the confirmation. */
    public function summary(Customer $customer): array
    {
        $id = $customer->id;
        return [
            'orders' => Order::where('customer_id', $id)->count(),
            'invoices' => Invoice::where('customer_id', $id)->count(),
            'credit_notes' => CreditNote::where('customer_id', $id)->count(),
            'receipts' => Payment::where('customer_id', $id)->count(),
            'quotes' => Quote::where('customer_id', $id)->count(),
        ];
    }

    public function delete(Customer $customer): void
    {
        $id = $customer->id;

        DB::transaction(function () use ($customer, $id) {
            // Orders take their own invoice, credit notes, receipts, cheques and dispatch with them.
            $orders = app(OrderDeletionService::class);
            Order::where('customer_id', $id)->get()->each(fn (Order $order) => $orders->delete($order));

            // What is left was raised without an order. Credit notes first, while the invoices they
            // were applied to still exist.
            $creditNotes = app(CreditNoteService::class);
            CreditNote::where('customer_id', $id)->get()->each(fn (CreditNote $note) => $creditNotes->delete($note));

            $paymentIds = Payment::where('customer_id', $id)->pluck('id');
            PaymentAllocation::whereIn('payment_id', $paymentIds)->delete();
            Cheque::whereIn('payment_id', $paymentIds)->delete();
            if (Schema::hasTable('mpesa_transactions')) {
                // The M-Pesa record itself is the bank's; it just stops pointing at the deleted receipt.
                DB::table('mpesa_transactions')->whereIn('payment_id', $paymentIds)->update(['payment_id' => null]);
            }
            Payment::whereIn('id', $paymentIds)->get()->each->delete();

            foreach (Invoice::where('customer_id', $id)->get() as $invoice) {
                PaymentAllocation::where('invoice_id', $invoice->id)->delete();
                Cheque::where('invoice_id', $invoice->id)->delete();
                $invoice->lineItems()->delete();
                $invoice->delete();
            }
            Cheque::where('customer_id', $id)->delete();

            foreach (Quote::where('customer_id', $id)->get() as $quote) {
                $quote->quoteItems()->delete();
                $quote->quoteNotes()->delete();
                $quote->delete();
            }

            foreach (['collection_notes', 'collection_actions'] as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->where('party_type', 'customer')->where('party_id', $id)->delete();
                }
            }

            if (is_null($customer->deleted_at)) {
                $customer->delete();
            }
        });
    }
}
