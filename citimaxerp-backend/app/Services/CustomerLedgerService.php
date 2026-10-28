<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\Cheque;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * A customer's double entries: every journal entry with a line tagged to the customer (invoices,
 * receipts, refunds, credit notes and their reversals), shown with all of its lines - the
 * receivable side and the other side (sales, VAT, bank/cash).
 */
class CustomerLedgerService
{
    public function __construct(protected AccountingIntegrationService $engine)
    {
    }

    /** Ids of the ledger journal entries that touch this customer. */
    public function entryIdsQuery(string $companyId, string $customerId): Builder
    {
        return DB::table('journal_entry_items')
            ->select('journal_entry_id')
            ->where('company_id', $companyId)
            ->where('contact_id', $customerId)
            ->where('contact_type', Customer::class);
    }

    public function ledger(string $companyId, string $customerId, ?string $dateFrom, ?string $dateTo, bool $hideCorrections = false): array
    {
        $receivableIds = $this->receivableAccountIds($companyId);
        $entryIds = $this->entryIdsQuery($companyId, $customerId);

        $base = JournalEntry::where('company_id', $companyId)
            ->whereIn('status', JournalEntry::LEDGER_STATUSES)
            ->whereIn('id', $entryIds);

        $hidden = $hideCorrections ? $this->correctionIds($customerId, clone $base) : [];
        if ($hidden) {
            $base->whereNotIn('id', $hidden);
        }

        // What the customer owed before the period: their receivable lines in earlier entries.
        $opening = 0.0;
        if ($dateFrom) {
            $opening = (float) JournalEntryItem::whereIn('journal_entry_id', (clone $base)->where('entry_date', '<', $dateFrom)->select('id'))
                ->where('contact_id', $customerId)
                ->where('contact_type', Customer::class)
                ->whereIn('account_id', $receivableIds)
                ->selectRaw('COALESCE(SUM(debit_amount - credit_amount), 0) as net')
                ->value('net');
        }

        $query = (clone $base)->with('items.account');
        if ($dateFrom) {
            $query->where('entry_date', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->where('entry_date', '<=', $dateTo);
        }
        $entries = $this->bouncesTogether($customerId, $query->orderBy('entry_date')->orderBy('created_at')->get());

        $balance = round($opening, 2);
        $totalDebit = 0.0;
        $totalCredit = 0.0;
        $rows = [];

        foreach ($entries as $entry) {
            $receivableChange = 0.0;
            $lines = [];
            // Debits first, as a journal is written.
            foreach ($entry->items->sortBy(fn ($i) => (float) $i->debit_amount > 0 ? 0 : 1) as $item) {
                $debit = round((float) $item->debit_amount, 2);
                $credit = round((float) $item->credit_amount, 2);
                $isCustomerLine = $item->contact_id === $customerId && $item->contact_type === Customer::class;
                if ($isCustomerLine && in_array($item->account_id, $receivableIds, true)) {
                    $receivableChange += $debit - $credit;
                }
                $lines[] = [
                    'account_id' => $item->account_id,
                    'account_code' => $item->account?->account_code,
                    'account_name' => $item->account?->account_name,
                    'description' => $item->description,
                    'debit' => $debit,
                    'credit' => $credit,
                    'is_customer_line' => $isCustomerLine,
                ];
                $totalDebit += $debit;
                $totalCredit += $credit;
            }

            $balance = round($balance + $receivableChange, 2);
            $rows[] = [
                'id' => $entry->id,
                'entry_number' => $entry->entry_number,
                'date' => $entry->entry_date?->toDateString(),
                'reference' => $entry->reference,
                'description' => $entry->description,
                'status' => $entry->status,
                'transaction_type' => $entry->metadata['transaction_type'] ?? null,
                'lines' => $lines,
                'total_debit' => round(array_sum(array_column($lines, 'debit')), 2),
                'total_credit' => round(array_sum(array_column($lines, 'credit')), 2),
                'receivable_change' => round($receivableChange, 2),
                'balance' => $balance,
            ];
        }

        return [
            'receivable_accounts' => ChartOfAccount::whereIn('id', $receivableIds)
                ->get(['id', 'account_code', 'account_name'])
                ->map(fn ($a) => ['id' => $a->id, 'code' => $a->account_code, 'name' => $a->account_name])
                ->values(),
            'period' => ['from' => $dateFrom, 'to' => $dateTo],
            'hidden_corrections' => count($hidden),
            'opening_balance' => round($opening, 2),
            'entries' => $rows,
            'totals' => [
                'debit' => round($totalDebit, 2),
                'credit' => round($totalCredit, 2),
                'closing_balance' => $balance,
            ],
        ];
    }

    /**
     * Entries replaced when their document was edited: each reversed entry and the reversal that
     * cancels it. Together they net to nothing, so hiding both leaves every balance as it is. A
     * bounced cheque's receipt and its reversal stay: the bounce is part of the account.
     */
    protected function correctionIds(string $customerId, $base): array
    {
        $bouncedPayments = Cheque::where('customer_id', $customerId)
            ->where('direction', 'received')
            ->where('status', 'bounced')
            ->whereNotNull('payment_id')
            ->pluck('payment_id')
            ->all();

        $hiddenOriginals = (clone $base)->where('status', 'reversed')
            ->get(['id', 'source_type', 'source_id'])
            ->reject(fn ($e) => $e->source_type === Payment::class && in_array($e->source_id, $bouncedPayments, true))
            ->pluck('id')
            ->all();

        $hiddenReversals = (clone $base)->where('source_type', JournalEntry::class)
            ->whereIn('source_id', $hiddenOriginals)
            ->pluck('id')
            ->all();

        return array_merge($hiddenOriginals, $hiddenReversals);
    }

    /**
     * A bounced cheque's receipt reversal goes last on its date, followed straight away by the
     * cheque's bounced cheque charges entry.
     */
    protected function bouncesTogether(string $customerId, $entries)
    {
        $cheques = Cheque::where('customer_id', $customerId)
            ->where('direction', 'received')
            ->where('status', 'bounced')
            ->get(['id', 'payment_id', 'bounce_charge_invoice_id']);
        if ($cheques->isEmpty()) {
            return $entries;
        }

        $byPayment = $cheques->filter(fn ($c) => $c->payment_id)->pluck('id', 'payment_id');
        $byCharge = $cheques->filter(fn ($c) => $c->bounce_charge_invoice_id)->pluck('id', 'bounce_charge_invoice_id');
        $originalIds = $entries->map(fn ($e) => $e->metadata['original_entry_id'] ?? null)->filter()->values();
        $originals = JournalEntry::whereIn('id', $originalIds)->where('source_type', Payment::class)->pluck('source_id', 'id');

        $place = function (JournalEntry $e) use ($byPayment, $byCharge, $originals) {
            if ($e->source_type === Invoice::class && isset($byCharge[$e->source_id])) {
                return [1, $byCharge[$e->source_id], 1];
            }
            $paymentId = $originals[$e->metadata['original_entry_id'] ?? ''] ?? null;
            if ($paymentId && isset($byPayment[$paymentId])) {
                return [1, $byPayment[$paymentId], 0];
            }
            return [0, '', 0];
        };

        return $entries->values()
            ->map(fn ($e, $i) => [$e, $place($e), $i])
            ->sort(function ($a, $b) {
                return [$a[0]->entry_date->toDateString(), $a[1], $a[2]] <=> [$b[0]->entry_date->toDateString(), $b[1], $b[2]];
            })
            ->map(fn ($x) => $x[0])
            ->values();
    }

    /**
     * The customer's receivable account(s): the one mapped to accounts_receivable plus any
     * receivables-subtype account, so entries posted before a mapping change still count.
     */
    protected function receivableAccountIds(string $companyId): array
    {
        $ids = ChartOfAccount::where('company_id', $companyId)
            ->where('account_subtype', 'receivables')
            ->pluck('id')
            ->all();

        try {
            $mapped = $this->engine->setCompany($companyId)->resolveAccountId('accounts_receivable');
            if ($mapped) {
                $ids[] = $mapped;
            }
        } catch (\Throwable $e) {
            // No mapping: fall back to the receivables-subtype accounts.
        }

        return array_values(array_unique($ids));
    }
}
