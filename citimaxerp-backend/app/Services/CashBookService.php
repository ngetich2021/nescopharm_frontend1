<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\BankTransfer;
use App\Models\ChartOfAccount;
use App\Models\Customer;
use App\Models\DeliveryInvoice;
use App\Models\Expense;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\Payment;
use App\Models\PaymentRefund;
use App\Models\PayrollRun;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Support\Facades\DB;

/**
 * The Bank Book (e.g. Prime Bank) and the Cash Book (Cash at Hand / Petty Cash): one money
 * account's entries from the ledger in the Tally layout - Date, Dr/Cr and Particulars (who paid
 * in or what was paid for), Vch Type, Vch No, Receipts (Debit), Payments (Credit) and the running
 * balance after each line, with Opening Balance first and Total / Closing Balance last.
 *
 * Withdrawals from the bank into cash are transfers, so they show in both books: a Payment in the
 * Bank Book and a Receipt in the Cash Book. Each book reconciles on its own.
 */
class CashBookService
{
    /**
     * The company's money accounts: those linked to a finance bank account, plus whatever the cash,
     * bank and M-Pesa payment methods post to - each with its ledger balance.
     */
    public function moneyAccounts(string $companyId): \Illuminate\Support\Collection
    {
        $banks = DB::table('bank_accounts')->where('company_id', $companyId)->whereNull('deleted_at')
            ->whereNotNull('chart_of_account_id')->get(['chart_of_account_id', 'bank_name', 'account_number', 'account_name']);
        $mapped = DB::table('company_account_mappings')->where('company_id', $companyId)->whereNull('context_type')
            ->whereIn('mapping_key', ['cash_on_hand', 'petty_cash', 'main_bank', 'mpesa_float'])->pluck('chart_of_account_id');

        $accounts = ChartOfAccount::where('company_id', $companyId)
            ->whereIn('id', $banks->pluck('chart_of_account_id')->merge($mapped)->filter()->unique())
            ->orderBy('account_code')->get();
        $balances = app(LedgerBalanceService::class)->balances($companyId, null, $accounts);

        return $accounts->map(function ($a) use ($banks, $balances) {
            $bank = $banks->firstWhere('chart_of_account_id', $a->id);
            return [
                'id' => $a->id,
                'code' => $a->account_code,
                'name' => $a->account_name,
                'label' => $bank ? "{$a->account_name} - {$bank->bank_name} {$bank->account_number}" : $a->account_name,
                'balance' => (float) ($balances[$a->id] ?? 0),
            ];
        })->values();
    }

    public function book(string $companyId, ChartOfAccount $account, ?string $dateFrom, ?string $dateTo, bool $showCorrections = false): array
    {
        $base = JournalEntry::where('company_id', $companyId)
            ->whereIn('status', JournalEntry::LEDGER_STATUSES)
            ->whereIn('id', JournalEntryItem::select('journal_entry_id')->where('company_id', $companyId)->where('account_id', $account->id));

        // An entry reversed for an edit, and its reversal, cancel out: hidden unless asked for.
        if (!$showCorrections) {
            $reversed = (clone $base)->where('status', 'reversed')->pluck('id')->all();
            $reversals = $reversed ? (clone $base)->where('source_type', JournalEntry::class)->whereIn('source_id', $reversed)->pluck('id')->all() : [];
            if ($reversed || $reversals) {
                $base->whereNotIn('id', array_merge($reversed, $reversals));
            }
        }

        // Opening: the account's own opening balance plus every movement before the period (a money account is debit-normal).
        $opening = (float) $account->opening_balance;
        if ($dateFrom) {
            $o = JournalEntryItem::where('account_id', $account->id)
                ->whereIn('journal_entry_id', (clone $base)->where('entry_date', '<', $dateFrom)->select('id'))
                ->selectRaw('COALESCE(SUM(debit_amount), 0) AS d, COALESCE(SUM(credit_amount), 0) AS c')->first();
            $opening += (float) $o->d - (float) $o->c;
        }
        $opening = round($opening, 2);

        $entries = (clone $base)->with('items.account')
            ->when($dateFrom, fn ($q) => $q->where('entry_date', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->where('entry_date', '<=', $dateTo))
            ->orderBy('entry_date')->orderBy('created_at')
            ->get();

        // Names for the people on the other side of each entry (customer by business name).
        $contactIds = $entries->flatMap(fn ($e) => $e->items)->whereNotNull('contact_id');
        $customers = Customer::whereIn('id', $contactIds->where('contact_type', Customer::class)->pluck('contact_id')->unique())
            ->get(['id', 'name', 'business_name'])->mapWithKeys(fn ($c) => [$c->id => $c->display_name]);
        $suppliers = Supplier::whereIn('id', $contactIds->where('contact_type', Supplier::class)->pluck('contact_id')->unique())
            ->pluck('name', 'id');

        $rows = [];
        $receipts = 0.0;
        $payments = 0.0;
        $balance = $opening;
        foreach ($entries as $entry) {
            $own = $entry->items->where('account_id', $account->id);
            $debit = round((float) $own->sum('debit_amount'), 2);
            $credit = round((float) $own->sum('credit_amount'), 2);
            if ($debit < 0.005 && $credit < 0.005) {
                continue;
            }
            $others = $entry->items->where('account_id', '!=', $account->id)
                ->sortByDesc(fn ($i) => (float) $i->debit_amount + (float) $i->credit_amount)->values();
            $main = $others->first();
            $party = null;
            foreach ($others as $i) {
                if ($i->contact_id) {
                    $party = $i->contact_type === Customer::class ? ($customers[$i->contact_id] ?? null) : ($suppliers[$i->contact_id] ?? null);
                    if ($party) {
                        break;
                    }
                }
            }
            $receipts += $debit;
            $payments += $credit;
            $balance = round($balance + $debit - $credit, 2);

            $rows[] = [
                'id' => $entry->id,
                'date' => $entry->entry_date?->toDateString(),
                // Tally: a receipt into the book is "To <party>" credited (Cr), a payment "By <account>" debited (Dr).
                'side' => $main ? ((float) $main->debit_amount > 0 ? 'Dr' : 'Cr') : ($debit > 0 ? 'Cr' : 'Dr'),
                'particulars' => $party ?? $main?->account?->account_name ?? ($entry->description ?: '-'),
                'account' => $main?->account?->account_name,
                'other_accounts' => $others->skip(1)->map(fn ($i) => ((float) $i->debit_amount > 0 ? 'Dr ' : 'Cr ')
                    . $i->account?->account_name . ' ' . number_format((float) $i->debit_amount + (float) $i->credit_amount, 2))->values(),
                'voucher_type' => $this->voucherType($entry),
                'voucher_no' => $entry->reference ?: $entry->entry_number,
                'narration' => $entry->description,
                'reversed' => $entry->status === 'reversed' || ($entry->source_type === JournalEntry::class && $entry->entry_type !== 'manual'),
                'debit' => $debit,
                'credit' => $credit,
                'balance' => abs($balance),
                'balance_side' => $balance >= 0 ? 'Dr' : 'Cr',
                'running' => $balance,
                'source_type' => $entry->source_type,
                'source_id' => $entry->source_id,
            ];
        }

        $closing = round($opening + $receipts - $payments, 2);

        return [
            'account' => ['id' => $account->id, 'code' => $account->account_code, 'name' => $account->account_name],
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            // Dr = money in the account; Cr = overdrawn (or more paid out than was ever recorded coming in).
            'opening_balance' => ['amount' => abs($opening), 'side' => $opening >= 0 ? 'Dr' : 'Cr', 'signed' => $opening],
            'rows' => $rows,
            'totals' => ['debit' => round($receipts, 2), 'credit' => round($payments, 2)],
            'closing_balance' => ['amount' => abs($closing), 'side' => $closing >= 0 ? 'Dr' : 'Cr', 'signed' => $closing],
        ];
    }

    private function voucherType(JournalEntry $entry): string
    {
        return match ($entry->source_type) {
            Payment::class => 'Receipt',
            PaymentRefund::class => 'Refund',
            SupplierPayment::class => 'Payment',
            Expense::class => 'Payment',
            BankTransfer::class => 'Contra',
            PayrollRun::class => 'Payroll',
            DeliveryInvoice::class => 'Delivery Invoice',
            AccountsPayable::class => 'Purchase',
            JournalEntry::class => $entry->entry_type === 'manual' ? 'Journal' : 'Reversal',
            default => $entry->entry_type === 'manual' ? 'Journal' : (($entry->metadata ?? [])['transaction_type'] ?? 'Journal'),
        };
    }
}
