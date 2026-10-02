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
    public function resolve(
        Customer $customer,
        string $referenceDate,
        ?string $explicitDueDate = null,
        ?string $explicitPaymentTerms = null,
    ): array {
        $isCredit = $customer->payment_method === 'credit';
        $creditDays = $isCredit ? $customer->account?->credit_days : null;

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
