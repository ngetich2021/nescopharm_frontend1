<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Order;
use Carbon\Carbon;

/**
 * Works out payment_type/credit_terms_days/due_date/payment_terms for a new
 * order or invoice from the customer's registered payment method and credit
 * terms, unless the caller explicitly supplied a due_date/payment_terms to
 * override it. Shared so orders and invoices stay consistent about which
 * customers are eligible for credit and on what terms.
 */
class CustomerCreditTermsResolver
{
    /**
     * $chosenCredit: staff picked credit for this sale (a past sale can go on credit
     * without the customer being registered for it), so it is a credit sale anyway.
     */
    public function resolve(
        Customer $customer,
        string $referenceDate,
        ?string $explicitDueDate = null,
        ?string $explicitPaymentTerms = null,
        bool $chosenCredit = false,
    ): array {
        $isCredit = $chosenCredit || $customer->payment_method === 'credit';
        // Same fallback as invoices: the Credit Appraisal Form's period (e.g. "60") when
        // credit_days was never set, so the order and its invoice carry the same days.
        $account = $customer->account;
        $creditDays = $isCredit && $account
            ? ($account->credit_days ?? (is_numeric($account->credit_period_required) ? (int) $account->credit_period_required : null))
            : null;

        if ($isCredit) {
            $days = $creditDays ?? 30;
            $dueDate = $explicitDueDate ?? Carbon::parse($referenceDate)->addDays($days)->toDateString();
            $paymentTerms = $explicitPaymentTerms ?? "Net {$days}";
        } else {
            $dueDate = $explicitDueDate ?? $referenceDate;
            $paymentTerms = $explicitPaymentTerms ?? 'Due on Receipt';
        }

        return [
            'payment_type' => $isCredit ? 'credit' : 'cash',
            'credit_terms_days' => $isCredit ? $creditDays : null,
            'due_date' => $dueDate,
            'payment_terms' => $paymentTerms,
        ];
    }

    /**
     * Credit invoices still owing after their due date (invoice date + the customer's credit
     * days). New credit sales are held back by these, not by the KES credit limit.
     */
    public function overdue(Customer $customer): array
    {
        $today = now('Africa/Nairobi')->toDateString();
        $invoices = Invoice::where('customer_id', $customer->id)
            ->where('company_id', $customer->company_id)
            ->where('payment_type', 'credit')
            ->whereNotIn('status', ['cancelled', 'paid'])
            ->where('balance_amount', '>', 0.005)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->orderBy('due_date')
            ->get(['invoice_number', 'due_date', 'balance_amount']);

        $oldest = $invoices->first();

        return [
            'count' => $invoices->count(),
            'amount' => round((float) $invoices->sum('balance_amount'), 2),
            'oldest_invoice' => $oldest?->invoice_number,
            'oldest_days' => $oldest ? (int) Carbon::parse($oldest->due_date)->diffInDays(Carbon::parse($today)) : 0,
        ];
    }

    /** Why a new credit sale can't go ahead, or null if it can. */
    public function overdueBlocker(Customer $customer): ?string
    {
        $o = $this->overdue($customer);
        if ($o['count'] === 0) {
            return null;
        }

        return "This customer has {$o['count']} credit invoice(s) past their credit days (KES "
            . number_format($o['amount'], 2) . " overdue; oldest {$o['oldest_invoice']}, {$o['oldest_days']} days late). "
            . 'Collect payment first, or sell on instant payment.';
    }

    /**
     * How much of this customer's credit limit is still unused - null if
     * they have no credit limit set at all (credit isn't meaningful for
     * them either way). Mirrors CustomerController::creditTerms() exactly
     * (outstanding credit invoices + unpaid/uninvoiced credit orders count
     * against the limit) so the number shown to a reviewer is the same one
     * enforced when converting a quote to an order.
     */
    public function getAvailableCredit(Customer $customer): ?float
    {
        $creditRequired = $customer->account?->credit_required;
        if ($creditRequired === null) {
            return null;
        }

        $creditUsed = (float) Invoice::where('customer_id', $customer->id)
            ->where('company_id', $customer->company_id)
            ->where('payment_type', 'credit')
            ->whereNotIn('status', ['cancelled'])
            ->sum('balance_amount');

        $creditUsed += Order::where('customer_id', $customer->id)
            ->where('company_id', $customer->company_id)
            ->where('payment_type', 'credit')
            ->where('payment_status', '!=', 'paid')
            ->whereDoesntHave('invoice')
            ->get()
            ->sum(fn ($order) => max(0, (float) $order->final_amount - (float) $order->amount_paid));

        return max(0, (float) $creditRequired - $creditUsed);
    }
}
