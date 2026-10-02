<?php

namespace App\Services;

use App\Models\Cheque;
use App\Models\Company;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use Carbon\Carbon;

class CustomerStatementService
{
    /**
     * A customer's account statement for an arbitrary period: opening
     * balance, every invoice/payment/credit-note/PD-cheque within the
     * period, and the resulting closing balance.
     *
     * Opening/closing balance are derived rather than stored: the
     * customer's current total outstanding balance is reconstructed back
     * to the period boundaries using invoices/payments/credit notes dated
     * after the period, then the period's own movements peel back further
     * to the opening figure.
     */
    public function generate(string $companyId, string $customerId, Carbon $from, Carbon $to): array
    {
        $customer = Customer::with('account')->where('company_id', $companyId)->findOrFail($customerId);

        $invoices = Invoice::where('customer_id', $customerId)
            ->whereBetween('invoice_date', [$from, $to])
            ->orderBy('invoice_date')
            ->get(['id', 'invoice_number', 'invoice_date', 'total_amount', 'balance_amount']);

        $payments = Payment::with('invoice:id,invoice_number')
            ->where('customer_id', $customerId)
            ->where('status', 'completed')
            ->whereBetween('payment_date', [$from, $to])
            ->orderBy('payment_date')
            ->get(['id', 'invoice_id', 'transaction_id', 'payment_date', 'amount_paid', 'payment_method']);

        $creditNotes = CreditNote::where('customer_id', $customerId)
            ->whereIn('status', ['issued', 'applied', 'refunded'])
            ->whereBetween('credit_note_date', [$from, $to])
            ->orderBy('credit_note_date')
            ->get(['id', 'credit_note_number', 'credit_note_date', 'total_amount']);

        $pdCheques = Cheque::where('customer_id', $customerId)
            ->where('direction', 'received')
            ->whereBetween('issue_date', [$from, $to])
            ->orderBy('issue_date')
            ->get(['id', 'cheque_number', 'bank_name', 'issue_date', 'maturity_date', 'amount', 'status']);

        // Get pending bills (invoices with outstanding balance)
        $pendingBills = Invoice::where('customer_id', $customerId)
            ->where('balance_amount', '>', 0)
            ->where('invoice_date', '<=', $to)
            ->orderBy('invoice_date')
            ->get(['id', 'invoice_number', 'invoice_date', 'total_amount', 'balance_amount', 'due_date'])
            ->map(function ($invoice) {
                $dueDate = $invoice->due_date ? Carbon::parse($invoice->due_date) : Carbon::parse($invoice->invoice_date)->addDays(30);
                $overdueDays = (int) max(0, $dueDate->copy()->startOfDay()->diffInDays(today(), false));
                return [
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'invoice_date' => $invoice->invoice_date,
                    'particulars' => 'Sales Account', // Generic particulars
                    'opening_amount' => $invoice->total_amount,
                    'pending_amount' => $invoice->balance_amount,
                    'due_date' => $dueDate->toDateString(),
                    'overdue_days' => $overdueDays,
                ];
            });

        $currentBalance = (float) Invoice::where('customer_id', $customerId)->sum('balance_amount');

        $invoicesAfter = (float) Invoice::where('customer_id', $customerId)
            ->where('invoice_date', '>', $to)->sum('total_amount');
        $paymentsAfter = (float) Payment::where('customer_id', $customerId)
            ->where('status', 'completed')->where('payment_date', '>', $to)->sum('amount_paid');
        $creditNotesAfter = (float) CreditNote::where('customer_id', $customerId)
            ->whereIn('status', ['issued', 'applied', 'refunded'])
            ->where('credit_note_date', '>', $to)->sum('total_amount');

        // Roll the current balance back to what it was at the period end,
        // then back again to what it was at the period start.
        $closingBalance = $currentBalance - $invoicesAfter + $paymentsAfter + $creditNotesAfter;

        $invoicesTotal = (float) $invoices->sum('total_amount');
        $paymentsTotal = (float) $payments->sum('amount_paid');
        $creditNotesTotal = (float) $creditNotes->sum('total_amount');

        $openingBalance = $closingBalance - $invoicesTotal + $paymentsTotal + $creditNotesTotal;

        $transactions = $this->buildTransactions($from, $openingBalance, $invoices, $payments, $creditNotes);
        $ageing = $this->buildAgeing($customerId, $to, $closingBalance);

        $account = $customer->account;
        $creditLimit = $account?->credit_required !== null ? (float) $account->credit_required : null;

        $company = Company::find($companyId, ['id', 'name', 'logo_url', 'letterhead_url', 'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch', 'mpesa_paybill', 'mpesa_account_number']);

        return [
            'customer' => $customer,
            // Sourced directly from the customer's own company_id, not a
            // separate frontend fetch gated by its own permission check -
            // the letterhead should always render, not "when available".
            'company' => $company ? array_merge($company->toArray(), [
                'payment_details' => [
                    'bank_name' => $company->bank_name,
                    'account_name' => $company->bank_account_name,
                    'account_number' => $company->bank_account_number,
                    'bank_branch' => $company->bank_branch,
                    'mpesa_paybill' => $company->mpesa_paybill,
                    'mpesa_account_number' => $company->mpesa_account_number,
                ]
            ]) : null,
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'label' => $this->formatPeriodLabel($from, $to),
            ],
            'opening_balance' => round($openingBalance, 2),
            'closing_balance' => round($closingBalance, 2),
            'account' => [
                'account_number' => $account?->account_number ?: $customer->customer_number,
                'payment_method' => $customer->payment_method,
                'credit_days' => $account?->credit_days,
                'credit_limit' => $creditLimit,
                'available_credit' => $creditLimit !== null ? round(max(0, $creditLimit - $closingBalance), 2) : null,
            ],
            'transactions' => $transactions,
            'ageing' => $ageing,
            'invoices' => $invoices,
            'payments' => $payments,
            'credit_notes' => $creditNotes,
            'pd_cheques' => $pdCheques,
            'pending_bills' => $pendingBills,
            'summary' => [
                'invoices_count' => $invoices->count(),
                'invoices_total' => round($invoicesTotal, 2),
                'payments_count' => $payments->count(),
                'payments_total' => round($paymentsTotal, 2),
                'credit_notes_count' => $creditNotes->count(),
                'credit_notes_total' => round($creditNotesTotal, 2),
                'pd_cheques_count' => $pdCheques->count(),
                'pd_cheques_total' => round((float) $pdCheques->sum('amount'), 2),
            ],
        ];
    }

    /**
     * Chronological ledger: opening balance, then every invoice (debit),
     * credit note and payment (credit) with a running balance.
     */
    private function buildTransactions(Carbon $from, float $openingBalance, $invoices, $payments, $creditNotes): array
    {
        $entries = collect();

        foreach ($invoices as $inv) {
            $entries->push([
                'date' => Carbon::parse($inv->invoice_date)->toDateString(),
                'order' => 0,
                'type' => 'invoice',
                'reference' => $inv->invoice_number,
                'description' => 'Invoice',
                'debit' => (float) $inv->total_amount,
                'credit' => 0.0,
            ]);
        }

        foreach ($creditNotes as $cn) {
            $entries->push([
                'date' => Carbon::parse($cn->credit_note_date)->toDateString(),
                'order' => 1,
                'type' => 'credit_note',
                'reference' => $cn->credit_note_number,
                'description' => 'Credit Note',
                'debit' => 0.0,
                'credit' => (float) $cn->total_amount,
            ]);
        }

        foreach ($payments as $p) {
            $method = $p->payment_method ? ucwords(str_replace('_', ' ', $p->payment_method)) : null;
            $description = 'Payment' . ($method ? " - {$method}" : '');
            if ($p->invoice?->invoice_number) {
                $description .= " ({$p->invoice->invoice_number})";
            }
            $entries->push([
                'date' => Carbon::parse($p->payment_date)->toDateString(),
                'order' => 2,
                'type' => 'payment',
                'reference' => $p->transaction_id ?: 'PMT-' . strtoupper(substr($p->id, 0, 8)),
                'description' => $description,
                'debit' => 0.0,
                'credit' => (float) $p->amount_paid,
            ]);
        }

        $balance = $openingBalance;
        $rows = [[
            'date' => $from->toDateString(),
            'type' => 'opening',
            'reference' => 'OB',
            'description' => 'Opening Balance',
            'debit' => null,
            'credit' => null,
            'balance' => round($balance, 2),
        ]];

        foreach ($entries->sortBy([['date', 'asc'], ['order', 'asc']]) as $e) {
            $balance += $e['debit'] - $e['credit'];
            unset($e['order']);
            $e['balance'] = round($balance, 2);
            $rows[] = $e;
        }

        return $rows;
    }

    /**
     * Outstanding invoice balances bucketed by days past due as at the
     * statement date. Any gap to the closing balance is unallocated
     * payments/credits not yet matched to an invoice.
     */
    private function buildAgeing(string $customerId, Carbon $asAt, float $closingBalance): array
    {
        $buckets = [
            'current' => ['label' => 'Current / Not Yet Due', 'amount' => 0.0],
            '1_30' => ['label' => '1–30 Days', 'amount' => 0.0],
            '31_60' => ['label' => '31–60 Days', 'amount' => 0.0],
            '61_90' => ['label' => '61–90 Days', 'amount' => 0.0],
            'over_90' => ['label' => 'Over 90 Days', 'amount' => 0.0],
        ];

        $outstanding = Invoice::where('customer_id', $customerId)
            ->where('balance_amount', '>', 0)
            ->whereNotIn('status', ['cancelled'])
            ->where('invoice_date', '<=', $asAt)
            ->get(['invoice_date', 'due_date', 'balance_amount']);

        foreach ($outstanding as $inv) {
            $due = $inv->due_date ? Carbon::parse($inv->due_date) : Carbon::parse($inv->invoice_date)->addDays(30);
            $daysOverdue = (int) $due->startOfDay()->diffInDays($asAt->copy()->startOfDay(), false);
            $key = match (true) {
                $daysOverdue <= 0 => 'current',
                $daysOverdue <= 30 => '1_30',
                $daysOverdue <= 60 => '31_60',
                $daysOverdue <= 90 => '61_90',
                default => 'over_90',
            };
            $buckets[$key]['amount'] += (float) $inv->balance_amount;
        }

        $invoicedTotal = array_sum(array_column($buckets, 'amount'));
        $unallocated = round($closingBalance - $invoicedTotal, 2);

        return [
            'as_at' => $asAt->toDateString(),
            'buckets' => array_map(fn ($b) => ['label' => $b['label'], 'amount' => round($b['amount'], 2)], array_values($buckets)),
            'unallocated' => abs($unallocated) >= 0.01 ? $unallocated : 0.0,
            'total' => round($closingBalance, 2),
        ];
    }

    /**
     * "1st - 30th September 2026" for a period within one calendar month,
     * or a full "1st January 2026 - 15th February 2026" style range
     * otherwise.
     */
    public function formatPeriodLabel(Carbon $from, Carbon $to): string
    {
        if ($from->month === $to->month && $from->year === $to->year) {
            return $from->format('jS') . ' - ' . $to->format('jS') . ' ' . $to->format('F Y');
        }

        return $from->format('jS F Y') . ' - ' . $to->format('jS F Y');
    }

    /**
     * Plain-text summary used for the auto-generated monthly note.
     */
    public function toText(array $statement): string
    {
        $summary = $statement['summary'];

        $lines = [
            'ACCOUNT STATEMENT - ' . $statement['period']['label'],
            '',
            'Opening balance: KES ' . number_format((float) $statement['opening_balance'], 2),
            "Invoices issued: {$summary['invoices_count']} (KES " . number_format($summary['invoices_total'], 2) . ')',
            "Payments received: {$summary['payments_count']} (KES " . number_format($summary['payments_total'], 2) . ')',
            "Credit notes issued: {$summary['credit_notes_count']} (KES " . number_format($summary['credit_notes_total'], 2) . ')',
            "PD cheques received: {$summary['pd_cheques_count']} (KES " . number_format($summary['pd_cheques_total'], 2) . ')',
            '',
            'Closing balance: KES ' . number_format((float) $statement['closing_balance'], 2),
        ];

        return implode("\n", $lines);
    }
}
