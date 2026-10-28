<?php

namespace App\Services;

use App\Models\Cheque;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * A customer's cheque that the bank dishonoured. If it was already approved, the money it put on
 * invoices is taken back off them (they owe it again) and its receipt is marked failed, which
 * removes the receipt from the ledger. Either way the customer is invoiced the bounced cheque
 * charge, once per cheque.
 */
class ChequeBounceService
{
    public const CHARGE = 2000.00;

    public function __construct(protected InvoicePaymentApplicationService $payments)
    {
    }

    /** @return array{reversed: array<int, array{invoice_number: string, amount: float}>, moved: array<int, array{from: string, to: string, amount: float}>, charge_invoice: ?Invoice} */
    public function bounceReceived(Cheque $cheque, User $user): array
    {
        if ($cheque->direction !== 'received') {
            throw new RuntimeException('Only a cheque received from a customer is bounced here');
        }
        if (!in_array($cheque->status, ['pending', 'approved'], true)) {
            throw new RuntimeException("Only a pending or approved cheque can be marked as bounced (current status: {$cheque->status})");
        }

        return DB::transaction(function () use ($cheque, $user) {
            $reversed = [];

            if ($cheque->status === 'approved' && $cheque->payment_id) {
                $payment = Payment::lockForUpdate()->find($cheque->payment_id);
                if ($payment) {
                    if ($payment->refunds()->whereIn('status', ['completed', 'pending'])->exists()) {
                        throw new RuntimeException('Part of this cheque was refunded to the customer; cancel that refund before marking the cheque bounced');
                    }

                    foreach (PaymentAllocation::where('payment_id', $payment->id)->get() as $allocation) {
                        $invoice = Invoice::lockForUpdate()->find($allocation->invoice_id);
                        if ($invoice) {
                            $invoice->update(['amount_paid' => max(0, round((float) $invoice->amount_paid - (float) $allocation->amount_allocated, 2))]);
                            $this->payments->syncOrderPaid($invoice->fresh());
                            $reversed[] = ['invoice_number' => $invoice->invoice_number, 'amount' => round((float) $allocation->amount_allocated, 2)];
                        }
                        $allocation->delete();
                    }

                    // No longer money received: the ledger drops the receipt (LedgerSyncObserver).
                    $payment->update(['status' => 'failed']);
                }
            }

            $cheque->update(['status' => 'bounced']);

            // The oldest invoices stay paid: money on newer invoices moves back to cover them,
            // so the shortfall from the bounce lands on the newest ones.
            $moved = $reversed && $cheque->customer_id
                ? app(CustomerAccountService::class)->rebalanceOldestFirst($cheque->company_id, $cheque->customer_id)
                : [];

            $charge = $cheque->bounce_charge_invoice_id ? Invoice::find($cheque->bounce_charge_invoice_id) : null;
            if (!$charge && $cheque->customer_id) {
                $charge = $this->raiseCharge($cheque, $user);
                $cheque->update(['bounce_charge_invoice_id' => $charge->id]);
            }

            return ['reversed' => $reversed, 'moved' => $moved, 'charge_invoice' => $charge];
        });
    }

    protected function raiseCharge(Cheque $cheque, User $user): Invoice
    {
        $customer = $cheque->customer;
        // Dated with the bounce (the day after it matured), so it follows the bounced cheque.
        $chargeDate = $cheque->bounceDate();

        $invoice = Invoice::create([
            'company_id' => $cheque->company_id,
            'customer_id' => $cheque->customer_id,
            'payment_type' => 'credit',
            'credit_terms_days' => 0,
            'type' => 'sales',
            // Issued straight away: a charge the customer owes now, not a draft to review.
            'status' => 'sent',
            'sent_at' => now(),
            'invoice_date' => $chargeDate,
            'due_date' => $chargeDate,
            'currency' => 'KES',
            'payment_terms' => 'Due on receipt',
            'mode_of_payment' => 'Due on receipt',
            'notes' => "Bounced cheque charges for cheque {$cheque->cheque_number}.",
            'other_references' => $customer ? collect([
                trim((string) $customer->contact_person_name) ?: trim((string) $customer->name),
                trim((string) $customer->contact_person_phone) ?: trim((string) $customer->phone),
                trim((string) $customer->contact_person_email) ?: trim((string) $customer->email),
            ])->filter()->implode(' · ') ?: null : null,
            // A charge, not a sale of goods: not sent to eTIMS.
            'etims_requested' => false,
            'created_by' => $user->id,
            'subtotal' => 0,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 0,
            'amount_paid' => 0,
            'balance_amount' => 0,
            'invoice_number' => $this->nextInvoiceNumber($cheque->company_id),
        ]);

        InvoiceLineItem::create([
            'invoice_id' => $invoice->id,
            'description' => "Bounced cheque charges for cheque {$cheque->cheque_number}.",
            'quantity' => 1,
            'unit' => 'service',
            'unit_price' => self::CHARGE,
            'discount_amount' => 0,
            'tax_rate' => 0,
            'metadata' => ['etims_tax_type_code' => 'D', 'bounced_cheque_id' => $cheque->id],
        ]);

        $invoice->load('lineItems');
        $invoice->calculateTotals();

        return $invoice->fresh();
    }

    // Same sequence as InvoiceController::generateInvoiceNumber.
    protected function nextInvoiceNumber(string $companyId): string
    {
        $prefix = 'INV-' . substr($companyId, 0, 8) . '-';
        $last = DB::table('invoices')
            ->where('company_id', $companyId)
            ->where('invoice_number', 'like', $prefix . '%')
            ->orderBy('invoice_number', 'desc')
            ->lockForUpdate()
            ->value('invoice_number');
        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
