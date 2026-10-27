<?php

namespace App\Services;

use App\Models\Cheque;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\CustomerAccount;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * A customer's running account: what they owe across every invoice (past sales brought across
 * included), the money of theirs not yet used on an invoice (receipts paid over an invoice, or
 * paid on account, and unused credit notes), and the PD cheques still waiting to mature.
 *
 * Money is applied oldest invoice first unless the person recording it chooses the split.
 * Whatever is left over stays with the customer as credit: it is used on the next invoice
 * (applyCredit) or handed back (the payment / credit-note refund flows).
 */
class CustomerAccountService
{
    public function __construct(protected InvoicePaymentApplicationService $payments)
    {
    }

    public function summary(string $companyId, string $customerId): array
    {
        $customer = Customer::where('company_id', $companyId)->findOrFail($customerId);
        $account = CustomerAccount::where('customer_id', $customerId)->latest()->first() ?? $customer->account;

        $invoices = Invoice::where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->whereNotIn('status', ['cancelled', 'void', 'voided'])
            ->where(function ($q) {
                $q->whereNull('type')->orWhere('type', '!=', 'proforma');
            })
            ->orderBy('invoice_date')
            ->orderBy('created_at')
            ->get(['id', 'order_id', 'invoice_number', 'invoice_date', 'due_date', 'total_amount', 'amount_paid', 'amount_credited', 'balance_amount', 'status']);

        $open = $invoices->filter(fn (Invoice $i) => $i->outstanding() > 0.005)->values();

        $credits = $this->unappliedPayments($companyId, $customerId);
        $usable = $credits->where('usable', true);
        $deposits = $credits->where('usable', false);

        $creditNotes = CreditNote::where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->where('status', 'issued')
            ->where('balance_amount', '>', 0.005)
            ->orderBy('credit_note_date')
            ->get(['id', 'credit_note_number', 'credit_note_date', 'invoice_id', 'total_amount', 'amount_applied', 'amount_refunded', 'balance_amount']);

        $pendingCheques = Cheque::with('invoice:id,invoice_number')
            ->where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->where('direction', 'received')
            ->where('status', 'pending')
            ->orderBy('maturity_date')
            ->get(['id', 'invoice_id', 'cheque_number', 'bank_name', 'amount', 'issue_date', 'maturity_date', 'allocation_plan']);

        $outstanding = round($open->sum(fn (Invoice $i) => $i->outstanding()), 2);
        $paymentCredit = round((float) $usable->sum('available'), 2);
        $creditNoteCredit = round((float) $creditNotes->sum('balance_amount'), 2);
        $creditAvailable = round($paymentCredit + $creditNoteCredit, 2);
        $depositTotal = round((float) $deposits->sum('available'), 2);
        $creditLimit = $account?->credit_required !== null ? (float) $account->credit_required : null;
        $netBalance = round($outstanding - $creditAvailable - $depositTotal, 2);

        return [
            'customer' => $customer->only(['id', 'name', 'business_name', 'customer_number', 'payment_method']),
            'account' => $account ? [
                'id' => $account->id,
                'account_number' => $account->account_number ?: $customer->customer_number,
                'credit_limit' => $creditLimit,
                'credit_days' => $account->credit_days,
                'credit_period_pd_cheque_days' => $account->credit_period_pd_cheque_days,
            ] : null,
            'totals' => [
                'invoiced' => round((float) $invoices->sum('total_amount'), 2),
                'paid' => round((float) $invoices->sum('amount_paid'), 2),
                'credited' => round((float) $invoices->sum('amount_credited'), 2),
                'outstanding' => $outstanding,
                'overdue' => round($open->filter(fn (Invoice $i) => $i->due_date && $i->due_date->lt(today()))->sum(fn (Invoice $i) => $i->outstanding()), 2),
                'credit_from_payments' => $paymentCredit,
                'credit_from_credit_notes' => $creditNoteCredit,
                'credit_available' => $creditAvailable,
                'deposits_on_uninvoiced_orders' => $depositTotal,
                'pending_cheques' => round((float) $pendingCheques->sum('amount'), 2),
                // Positive: the customer owes us. Negative: we hold the customer's money.
                'net_balance' => $netBalance,
                'available_credit_limit' => $creditLimit !== null ? round(max(0, $creditLimit - max(0, $netBalance)), 2) : null,
            ],
            'open_invoices' => $open->map(fn (Invoice $i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'invoice_date' => $i->invoice_date?->toDateString(),
                'due_date' => $i->due_date?->toDateString(),
                'total_amount' => round((float) $i->total_amount, 2),
                'amount_paid' => round((float) $i->amount_paid, 2),
                'amount_credited' => round((float) $i->amount_credited, 2),
                'balance' => $i->outstanding(),
                'status' => $i->status,
                'overdue' => $i->due_date && $i->due_date->lt(today()),
            ])->values(),
            'unapplied_payments' => $usable->map(fn ($c) => collect($c)->except('usable'))->values(),
            'deposits' => $deposits->map(fn ($c) => collect($c)->except('usable'))->values(),
            'unapplied_credit_notes' => $creditNotes->map(fn (CreditNote $n) => [
                'id' => $n->id,
                'credit_note_number' => $n->credit_note_number,
                'credit_note_date' => optional($n->credit_note_date)->toDateString(),
                'total_amount' => round((float) $n->total_amount, 2),
                'amount_applied' => round((float) $n->amount_applied, 2),
                'amount_refunded' => round((float) $n->amount_refunded, 2),
                'available' => round((float) $n->balance_amount, 2),
            ])->values(),
            'pending_cheques' => $pendingCheques->map(fn (Cheque $c) => [
                'id' => $c->id,
                'cheque_number' => $c->cheque_number,
                'bank_name' => $c->bank_name,
                'amount' => round((float) $c->amount, 2),
                'issue_date' => $c->issue_date?->toDateString(),
                'maturity_date' => $c->maturity_date?->toDateString(),
                'invoice_number' => $c->invoice?->invoice_number,
                'allocation_plan' => $c->allocation_plan,
            ])->values(),
        ];
    }

    /**
     * Completed receipts with money not yet on an invoice. `usable` is false for a deposit on an
     * order that has no invoice yet: that money belongs to its order and is applied when the
     * order is invoiced, so it is not offered as free credit. A receipt tied straight to an
     * invoice (the older auto-invoice path, with no allocation rows) counts as fully used.
     */
    public function unappliedPayments(string $companyId, string $customerId, bool $holdPendingRefunds = true): Collection
    {
        // A refund still waiting on its cheque is held back from what can be used, but the money
        // has not left yet, so the statement ($holdPendingRefunds = false) still counts it.
        $refundStatuses = $holdPendingRefunds ? ['completed', 'pending'] : ['completed'];

        $rows = DB::table('payments as p')
            ->leftJoinSub(
                DB::table('payment_allocations')->selectRaw('payment_id, SUM(amount_allocated) AS allocated, COUNT(*) AS n')->groupBy('payment_id'),
                'a', 'a.payment_id', '=', 'p.id'
            )
            ->leftJoinSub(
                DB::table('payment_refunds')->selectRaw("payment_id, SUM(amount) AS refunded")->whereIn('status', $refundStatuses)->groupBy('payment_id'),
                'r', 'r.payment_id', '=', 'p.id'
            )
            ->leftJoin('orders as o', 'o.id', '=', 'p.order_id')
            ->where('p.company_id', $companyId)
            ->where('p.customer_id', $customerId)
            ->where('p.status', 'completed')
            ->where('p.amount_paid', '>', 0)
            ->whereNull('p.invoice_id')
            ->where(function ($q) {
                $q->whereNotNull('a.payment_id')
                    ->orWhereNotExists(fn ($s) => $s->select(DB::raw(1))->from('invoices')->whereColumn('invoices.payment_id', 'p.id'));
            })
            ->selectRaw('p.id, p.order_id, o.order_number, p.payment_method, p.transaction_id, p.payment_date, p.amount_paid,
                COALESCE(a.allocated, 0) AS allocated, COALESCE(r.refunded, 0) AS refunded,
                EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = p.order_id) AS order_invoiced')
            ->orderBy('p.payment_date')
            ->orderBy('p.created_at')
            ->get();

        return $rows->map(function ($r) {
            $available = round((float) $r->amount_paid - (float) $r->allocated - (float) $r->refunded, 2);

            return [
                'id' => $r->id,
                'order_id' => $r->order_id,
                'order_number' => $r->order_number,
                'payment_method' => $r->payment_method,
                'reference' => $r->transaction_id,
                'payment_date' => $r->payment_date ? substr((string) $r->payment_date, 0, 10) : null,
                'amount_paid' => round((float) $r->amount_paid, 2),
                'allocated' => round((float) $r->allocated, 2),
                'refunded' => round((float) $r->refunded, 2),
                'available' => $available,
                'usable' => !$r->order_id || (bool) $r->order_invoiced,
            ];
        })->filter(fn ($c) => $c['available'] > 0.005)->values();
    }

    /**
     * Receive money from the customer on account: one receipt, spread over their open invoices.
     * $split is [{invoice_id, amount}] when the person chose it; otherwise oldest invoice first.
     * Any amount not placed on an invoice stays on the receipt as the customer's credit.
     */
    public function receive(
        Customer $customer,
        User $user,
        float $amount,
        string $method,
        ?string $paymentDate = null,
        ?string $reference = null,
        ?string $notes = null,
        ?array $split = null,
    ): array {
        if ($amount <= 0) {
            throw new RuntimeException('Amount must be more than zero');
        }

        return DB::transaction(function () use ($customer, $user, $amount, $method, $paymentDate, $reference, $notes, $split) {
            $payment = Payment::create([
                'id' => (string) Str::uuid(),
                'order_id' => null,
                'customer_id' => $customer->id,
                'company_id' => $customer->company_id,
                'payment_method' => $method,
                'transaction_id' => $reference ?: 'ACC-PAY-' . now()->format('YmdHis'),
                'amount_paid' => $amount,
                'status' => 'completed',
                'payment_date' => $paymentDate ?? now()->toDateString(),
            ]);

            $allocations = $this->allocate($payment, $split, $notes ?: 'Received on account');

            return [
                'payment' => $payment->fresh(),
                'allocations' => $allocations,
                'allocated' => round(array_sum(array_column($allocations, 'amount')), 2),
                'left_as_credit' => round($amount - array_sum(array_column($allocations, 'amount')), 2),
            ];
        });
    }

    /**
     * Put a receipt's unused money onto invoices of its customer. With a $split, each line is
     * capped at what that invoice still owes and what the receipt has left; without one, the
     * receipt's own order's invoice is paid first, then the oldest open invoices.
     *
     * @return array<int, array{invoice_id: string, invoice_number: string, amount: float, balance: float, status: string}>
     */
    public function allocate(Payment $payment, ?array $split = null, ?string $notes = null): array
    {
        return DB::transaction(function () use ($payment, $split, $notes) {
            $payment = Payment::lockForUpdate()->findOrFail($payment->id);
            $left = $this->paymentAvailable($payment);
            if ($left <= 0.005) {
                return [];
            }

            $plan = $split !== null
                ? collect($split)->filter(fn ($l) => !empty($l['invoice_id']) && (float) ($l['amount'] ?? 0) > 0)
                    ->map(fn ($l) => ['invoice_id' => $l['invoice_id'], 'amount' => (float) $l['amount']])->values()
                : $this->oldestFirst($payment->company_id, $payment->customer_id, $payment->order_id)
                    ->map(fn (Invoice $i) => ['invoice_id' => $i->id, 'amount' => null]);

            $done = [];
            foreach ($plan as $line) {
                if ($left <= 0.005) {
                    break;
                }
                $invoice = Invoice::where('company_id', $payment->company_id)
                    ->where('customer_id', $payment->customer_id)
                    ->lockForUpdate()
                    ->find($line['invoice_id']);
                if (!$invoice) {
                    throw new RuntimeException('Invoice not found for this customer');
                }
                $owed = $invoice->outstanding();
                $put = round(min($line['amount'] ?? $owed, $owed, $left), 2);
                if ($put <= 0.005) {
                    continue;
                }

                PaymentAllocation::create([
                    'payment_id' => $payment->id,
                    'invoice_id' => $invoice->id,
                    'amount_allocated' => $put,
                    'allocated_date' => now(),
                    'notes' => $notes,
                ]);
                $invoice->update(['amount_paid' => (float) $invoice->amount_paid + $put]);
                $this->payments->syncOrderPaid($invoice);
                $invoice->refresh();

                $left = round($left - $put, 2);
                $done[] = [
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'amount' => $put,
                    'balance' => $invoice->outstanding(),
                    'status' => $invoice->status,
                ];
            }

            // Payment's saved hook takes stock for the orders it pays, found through its
            // allocations, so save it again now they exist (past sales are skipped there).
            if ($done) {
                $payment->touch();
            }

            return $done;
        });
    }

    /**
     * Use the customer's credit (unused receipts first, then unused credit notes) on their
     * open invoices, oldest first. Deposits on orders not yet invoiced are left alone.
     */
    public function applyCredit(string $companyId, string $customerId): array
    {
        return DB::transaction(function () use ($companyId, $customerId) {
            $applied = [];

            foreach ($this->unappliedPayments($companyId, $customerId)->where('usable', true) as $credit) {
                $payment = Payment::find($credit['id']);
                foreach ($this->allocate($payment, null, 'Customer credit applied') as $row) {
                    $applied[] = $row + ['source' => 'payment', 'source_reference' => $credit['reference'] ?: substr($credit['id'], 0, 8)];
                }
            }

            $notes = CreditNote::where('company_id', $companyId)
                ->where('customer_id', $customerId)
                ->where('status', 'issued')
                ->where('balance_amount', '>', 0.005)
                ->orderBy('credit_note_date')
                ->get();
            $creditNotes = app(CreditNoteService::class);
            foreach ($notes as $note) {
                foreach ($this->oldestFirst($companyId, $customerId) as $invoice) {
                    $note->refresh();
                    if ((float) $note->balance_amount <= 0.005) {
                        break;
                    }
                    $put = $creditNotes->apply($note, $invoice);
                    if ($put > 0) {
                        $invoice->refresh();
                        $applied[] = [
                            'invoice_id' => $invoice->id,
                            'invoice_number' => $invoice->invoice_number,
                            'amount' => $put,
                            'balance' => $invoice->outstanding(),
                            'status' => $invoice->status,
                            'source' => 'credit_note',
                            'source_reference' => $note->credit_note_number,
                        ];
                    }
                }
            }

            return $applied;
        });
    }

    /** What a receipt still has to give: not on an invoice and not refunded (or being refunded). */
    public function paymentAvailable(Payment $payment): float
    {
        if ($payment->status !== 'completed') {
            return 0.0;
        }
        $direct = $payment->invoice_id
            || (!PaymentAllocation::where('payment_id', $payment->id)->exists() && Invoice::where('payment_id', $payment->id)->exists());
        if ($direct) {
            return 0.0;
        }

        return round((float) $payment->remaining_amount, 2);
    }

    /**
     * Oldest-first split of an amount over the customer's open invoices, for previewing a
     * receipt or a PD cheque before it is recorded.
     */
    public function suggestSplit(string $companyId, string $customerId, float $amount): array
    {
        $left = $amount;
        $lines = [];
        foreach ($this->oldestFirst($companyId, $customerId) as $invoice) {
            if ($left <= 0.005) {
                break;
            }
            $put = round(min($invoice->outstanding(), $left), 2);
            $lines[] = ['invoice_id' => $invoice->id, 'invoice_number' => $invoice->invoice_number, 'amount' => $put];
            $left = round($left - $put, 2);
        }

        return $lines;
    }

    /** Open invoices oldest first; when $orderId is given, that order's invoice leads. */
    protected function oldestFirst(string $companyId, string $customerId, ?string $orderId = null): Collection
    {
        return Invoice::where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->whereNotIn('status', ['cancelled', 'void', 'voided'])
            ->where(function ($q) {
                $q->whereNull('type')->orWhere('type', '!=', 'proforma');
            })
            ->when($orderId, fn ($q) => $q->orderByRaw('CASE WHEN order_id = ? THEN 0 ELSE 1 END', [$orderId]))
            ->orderBy('invoice_date')
            ->orderBy('created_at')
            ->get()
            ->filter(fn (Invoice $i) => $i->outstanding() > 0.005)
            ->values();
    }
}
