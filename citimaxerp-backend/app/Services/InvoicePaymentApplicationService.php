<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class InvoicePaymentApplicationService
{
    /**
     * Calculate invoice status based on payment amount and due date.
     */
    public function calculateInvoiceStatus($amountPaid, $totalAmount, $dueDate): string
    {
        if ($amountPaid >= $totalAmount) {
            return 'paid';
        }

        if ($amountPaid > 0) {
            return now()->isAfter($dueDate) ? 'overdue' : 'partially_paid';
        }

        if (now()->isAfter($dueDate)) {
            return 'overdue';
        }

        return 'draft';
    }

    /**
     * Apply a payment amount to an invoice: creates the Payment + PaymentAllocation,
     * updates the invoice balance/status, and records the accounting entry.
     *
     * Shared between direct payment recording (InvoiceController::recordPayment)
     * and cheque approval (ChequeController::approve), so both paths stay in sync.
     *
     * @throws RuntimeException when the payment would exceed the invoice balance
     */
    public function applyPayment(
        Invoice $invoice,
        User $user,
        float $amount,
        string $paymentMethod,
        ?string $transactionId = null,
        ?string $notes = null,
        ?string $paymentDate = null,
    ): array {
        $currentAmountPaid = $invoice->getTotalAllocatedAmount();
        $newAmountPaid = $currentAmountPaid + $amount;
        $newBalance = $invoice->total_amount - $newAmountPaid - (float) $invoice->amount_credited;

        if ($newBalance < -0.005) {
            throw new RuntimeException('Payment amount exceeds invoice balance');
        }

        DB::beginTransaction();

        try {
            $payment = Payment::create([
                'id' => Str::uuid(),
                'order_id' => $invoice->order_id,
                'customer_id' => $invoice->customer_id,
                'company_id' => $user->company_id,
                'payment_method' => $paymentMethod ?: 'manual',
                'transaction_id' => $transactionId ?: 'INV-PAY-' . time(),
                'amount_paid' => $amount,
                'status' => 'completed',
                'payment_date' => $paymentDate ?? now(),
            ]);

            $allocation = PaymentAllocation::create([
                'payment_id' => $payment->id,
                'invoice_id' => $invoice->id,
                'amount_allocated' => $amount,
                'allocated_date' => now(),
                'notes' => $notes,
            ]);

            $newStatus = $this->calculateInvoiceStatus($newAmountPaid, $invoice->total_amount, $invoice->due_date);

            // The receipt reaches the ledger via LedgerSyncObserver once this commits.
            $invoice->update([
                'amount_paid' => $newAmountPaid,
                'balance_amount' => $newBalance,
                'status' => $newStatus,
            ]);
            $this->syncOrderPaid($invoice);

            DB::commit();

            return [
                'invoice' => $invoice->fresh(),
                'payment' => $payment,
                'allocation' => $allocation,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /** The invoice's order shows the same money received (orders list, statements). */
    public function syncOrderPaid(Invoice $invoice): void
    {
        $order = $invoice->order_id ? \App\Models\Order::find($invoice->order_id) : null;
        if (!$order) {
            return;
        }
        $paid = (float) $invoice->amount_paid;
        $settled = $paid + (float) $invoice->amount_credited;
        $total = (float) $invoice->total_amount;
        $order->forceFill([
            'amount_paid' => $paid,
            'payment_status' => $settled >= $total - 0.01 && $total > 0 ? 'paid' : ($settled > 0 ? 'partial' : 'unpaid'),
        ])->saveQuietly();
    }
}
