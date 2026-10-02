<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class InvoicePaymentApplicationService
{
    public function __construct(protected AccountingWorkflowService $accountingWorkflow)
    {
    }

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
        $newBalance = $invoice->total_amount - $newAmountPaid;

        if ($newAmountPaid > $invoice->total_amount) {
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

            $invoice->update([
                'amount_paid' => $newAmountPaid,
                'balance_amount' => $newBalance,
                'status' => $newStatus,
            ]);

            try {
                $result = $this->accountingWorkflow
                    ->forCompany($user->company_id)
                    ->asUser($user->id)
                    ->onCustomerPaymentReceived($invoice, $amount, $payment->payment_method, $payment->transaction_id);

                Log::info($result ? 'Accounting entry created for payment' : 'Accounting entry skipped for payment (company settings)', [
                    'payment_id' => $payment->id,
                    'invoice_id' => $invoice->id,
                ]);
            } catch (\Exception $accountingError) {
                Log::warning('Failed to create accounting entry for payment', [
                    'payment_id' => $payment->id,
                    'invoice_id' => $invoice->id,
                    'error' => $accountingError->getMessage(),
                ]);
            }

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
}
