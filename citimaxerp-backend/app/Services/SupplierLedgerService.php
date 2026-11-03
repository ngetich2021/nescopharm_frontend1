<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\ChartOfAccount;
use App\Models\DeliveryInvoice;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\ProductReceipt;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Support\Facades\DB;

/**
 * A supplier's (or transporter's) ledger account from the books, laid out as the client's Tally
 * ledgers are: Date, Dr/Cr and Particulars (the other side of the double entry), Vch Type, Vch No,
 * Debit, Credit, then Totals and the Closing Balance with its side. A payment debits the supplier
 * (Particulars "Cr Prime Bank"); a bill credits it ("Dr Purchase Account").
 */
class SupplierLedgerService
{
    public function __construct(protected AccountingIntegrationService $engine)
    {
    }

    public function ledger(string $companyId, Supplier $supplier, ?string $dateFrom, ?string $dateTo, bool $showCorrections = false): array
    {
        $payables = $this->payableAccountIds($companyId);
        $entryIds = DB::table('journal_entry_items')->select('journal_entry_id')
            ->where('company_id', $companyId)->where('contact_id', $supplier->id)->where('contact_type', Supplier::class)
            ->whereIn('account_id', $payables);

        $base = JournalEntry::where('company_id', $companyId)
            ->whereIn('status', JournalEntry::LEDGER_STATUSES)
            ->whereIn('id', $entryIds);

        // An entry reversed for an edit, and its reversal, cancel out: hidden unless asked for.
        if (!$showCorrections) {
            $reversed = (clone $base)->where('status', 'reversed')->pluck('id')->all();
            $reversals = $reversed ? (clone $base)->where('source_type', JournalEntry::class)->whereIn('source_id', $reversed)->pluck('id')->all() : [];
            if ($reversed || $reversals) {
                $base->whereNotIn('id', array_merge($reversed, $reversals));
            }
        }

        // The supplier's own lines on Payables: debit lowers what is owed, credit raises it.
        $supplierLines = fn ($q) => $q->where('contact_id', $supplier->id)->where('contact_type', Supplier::class)->whereIn('account_id', $payables);

        $opening = ['debit' => 0.0, 'credit' => 0.0];
        if ($dateFrom) {
            $o = JournalEntryItem::whereIn('journal_entry_id', (clone $base)->where('entry_date', '<', $dateFrom)->select('id'))
                ->tap($supplierLines)
                ->selectRaw('COALESCE(SUM(debit_amount), 0) AS d, COALESCE(SUM(credit_amount), 0) AS c')->first();
            $opening = ['debit' => round((float) $o->d, 2), 'credit' => round((float) $o->c, 2)];
        }
        $openingNet = round($opening['credit'] - $opening['debit'], 2);

        $entries = (clone $base)->with('items.account')
            ->when($dateFrom, fn ($q) => $q->where('entry_date', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->where('entry_date', '<=', $dateTo))
            ->orderBy('entry_date')->orderBy('created_at')
            ->get();

        $rows = [];
        $totalDebit = 0.0;
        $totalCredit = 0.0;
        $balance = $openingNet;
        foreach ($entries as $entry) {
            $own = $entry->items->filter(fn ($i) => $i->contact_id === $supplier->id && $i->contact_type === Supplier::class && in_array($i->account_id, $payables, true));
            $debit = round((float) $own->sum('debit_amount'), 2);
            $credit = round((float) $own->sum('credit_amount'), 2);
            if ($debit < 0.005 && $credit < 0.005) {
                continue;
            }
            // Particulars: the other side of the entry, biggest first (a bill with VAT names the purchase account).
            $others = $entry->items->reject(fn ($i) => $own->contains($i))
                ->sortByDesc(fn ($i) => (float) $i->debit_amount + (float) $i->credit_amount)->values();
            $main = $others->first();
            $side = $debit >= $credit ? 'Cr' : 'Dr';
            $totalDebit += $debit;
            $totalCredit += $credit;
            $balance = round($balance + $credit - $debit, 2);

            $rows[] = [
                'id' => $entry->id,
                'date' => $entry->entry_date?->toDateString(),
                'side' => $main ? ((float) $main->debit_amount > 0 ? 'Dr' : 'Cr') : $side,
                'particulars' => $main?->account?->account_name ?? ($entry->description ?: '-'),
                'other_accounts' => $others->skip(1)->map(fn ($i) => ((float) $i->debit_amount > 0 ? 'Dr ' : 'Cr ')
                    . $i->account?->account_name . ' ' . number_format((float) $i->debit_amount + (float) $i->credit_amount, 2))->values(),
                'voucher_type' => $this->voucherType($entry),
                'voucher_no' => $entry->reference ?: $entry->entry_number,
                'narration' => $entry->description,
                'reversed' => $entry->status === 'reversed' || $entry->source_type === JournalEntry::class && $entry->source_id && $entry->entry_type !== 'manual',
                'debit' => $debit,
                'credit' => $credit,
                'balance' => abs($balance),
                'balance_side' => $balance >= 0 ? 'Cr' : 'Dr',
            ];
        }

        $closing = round($openingNet + $totalCredit - $totalDebit, 2);

        return [
            'supplier' => ['id' => $supplier->id, 'name' => $supplier->name],
            'payable_accounts' => ChartOfAccount::whereIn('id', $payables)->get(['account_code', 'account_name'])
                ->map(fn ($a) => "{$a->account_code} {$a->account_name}")->values(),
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            // Balances as Tally prints them: an amount and its side (Cr = we owe the supplier).
            'opening_balance' => ['amount' => abs($openingNet), 'side' => $openingNet >= 0 ? 'Cr' : 'Dr'],
            'rows' => $rows,
            'totals' => ['debit' => round($totalDebit, 2), 'credit' => round($totalCredit, 2)],
            'closing_balance' => ['amount' => abs($closing), 'side' => $closing >= 0 ? 'Cr' : 'Dr'],
        ];
    }

    private function voucherType(JournalEntry $entry): string
    {
        $meta = $entry->metadata ?? [];
        return match ($entry->source_type) {
            SupplierPayment::class => 'Payment',
            DeliveryInvoice::class => 'Delivery Invoice',
            ProductReceipt::class => 'Goods Received',
            AccountsPayable::class => (function () use ($entry) {
                $bill = AccountsPayable::find($entry->source_id);
                $billMeta = $bill?->metadata ?? [];
                if (($billMeta['kind'] ?? 'bill') === 'debit_note') {
                    return 'Debit Note';
                }
                return $billMeta['voucher_type'] ?? 'Purchase';
            })(),
            JournalEntry::class => $entry->entry_type === 'manual' ? 'Journal' : 'Reversal',
            default => $meta['transaction_type'] ?? 'Journal',
        };
    }

    /** Payables accounts: the mapped Accounts Payable plus any account of the payables subtype. */
    protected function payableAccountIds(string $companyId): array
    {
        $ids = ChartOfAccount::where('company_id', $companyId)->where('account_subtype', 'payables')->pluck('id')->all();
        try {
            $mapped = $this->engine->setCompany($companyId)->resolveAccountId('accounts_payable');
            if ($mapped) {
                $ids[] = $mapped;
            }
        } catch (\Throwable $e) {
            // No mapping: the payables-subtype accounts.
        }

        return array_values(array_unique($ids));
    }
}
