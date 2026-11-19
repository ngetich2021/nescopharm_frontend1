<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Bank Reconciliation Statement, as in Tally: every Bank Book entry (from CashBookService) gets the
 * Bank Date it went through the bank. As at a statement date S:
 *
 *   Balance as per Company Books (book balance at S)
 *   - Deposits not yet credited by the bank (receipts dated by S, no bank date by S)
 *   + Payments not yet debited by the bank (cheques issued etc. dated by S, no bank date by S)
 *   + / - Amounts in the bank but not yet in the books (entries dated after S, cleared by S)
 *   = Balance as per Bank, which must equal the statement balance.
 *
 * Saving a reconciliation records that agreement and locks the bank dates it covered, until it is reopened.
 */
class BankReconciliationStatementService
{
    public function __construct(private CashBookService $books) {}

    /** Bank accounts only (Prime Bank ...): the money accounts minus cash on hand / petty cash. */
    public function bankAccounts(string $companyId): Collection
    {
        $cash = DB::table('company_account_mappings')->where('company_id', $companyId)->whereNull('context_type')
            ->whereIn('mapping_key', ['cash_on_hand', 'petty_cash'])->pluck('chart_of_account_id')->flip();

        return $this->books->moneyAccounts($companyId)->reject(fn ($a) => isset($cash[$a['id']]))->values()
            ->map(fn ($a) => $a + ['last_reconciled' => $this->lastCompleted($companyId, $a['id'])?->statement_date]);
    }

    public function lastCompleted(string $companyId, string $accountId): ?object
    {
        return DB::table('bank_reconciliation_statements')->where('company_id', $companyId)->where('account_id', $accountId)
            ->orderByDesc('statement_date')->first();
    }

    /**
     * The statement as at $statementDate: rows (uncleared ones, or all) with their bank dates, and the summary.
     * $statementBalance is what the bank statement shows (null = not typed yet).
     */
    public function statement(string $companyId, ChartOfAccount $account, string $statementDate, ?float $statementBalance, string $show = 'uncleared', ?string $dateFrom = null): array
    {
        $S = Carbon::parse($statementDate)->toDateString();
        $book = $this->books->book($companyId, $account, null, null);
        $clearings = DB::table('bank_clearings')->where('company_id', $companyId)->where('account_id', $account->id)
            ->pluck('bank_date', 'journal_entry_id');
        $last = $this->lastCompleted($companyId, $account->id);
        $lockedTo = $last?->statement_date;

        $bookBalance = (float) $book['opening_balance']['signed'];
        $notCreditedDr = 0.0;   // receipts in the books, not yet in the bank
        $notDebitedCr = 0.0;    // payments in the books, not yet in the bank
        $bankOnlyDr = 0.0;      // in the bank by S, in the books after S
        $bankOnlyCr = 0.0;
        $rows = [];
        $clearedByS = 0;

        foreach ($book['rows'] as $r) {
            $bankDate = isset($clearings[$r['id']]) ? Carbon::parse($clearings[$r['id']])->toDateString() : null;
            $inBooks = $r['date'] <= $S;
            $inBank = $bankDate !== null && $bankDate <= $S;
            if ($inBooks) {
                $bookBalance += $r['debit'] - $r['credit'];
                if (!$inBank) {
                    $notCreditedDr += $r['debit'];
                    $notDebitedCr += $r['credit'];
                } else {
                    $clearedByS++;
                }
            } elseif ($inBank) {
                $bankOnlyDr += $r['debit'];
                $bankOnlyCr += $r['credit'];
            }

            $status = $inBooks ? ($inBank ? 'cleared' : 'not_in_bank') : ($inBank ? 'not_in_books' : 'after');
            $listed = match ($show) {
                'all' => $inBooks || $inBank,
                default => $status === 'not_in_bank' || $status === 'not_in_books',
            };
            if ($listed && $dateFrom && $r['date'] < $dateFrom && $status !== 'not_in_bank') {
                $listed = false;
            }
            if (!$listed) {
                continue;
            }
            $rows[] = [
                'id' => $r['id'],
                'date' => $r['date'],
                'particulars' => $r['particulars'],
                'account' => $r['account'],
                'narration' => $r['narration'],
                'voucher_type' => $r['voucher_type'],
                'voucher_no' => $r['voucher_no'],
                'debit' => $r['debit'],
                'credit' => $r['credit'],
                'bank_date' => $bankDate,
                'status' => $status,
                'locked' => $lockedTo && $bankDate && $bankDate <= $lockedTo && $r['date'] <= $lockedTo,
            ];
        }

        $bookBalance = round($bookBalance, 2);
        $bankFromBooks = round($bookBalance - $notCreditedDr + $notDebitedCr + $bankOnlyDr - $bankOnlyCr, 2);

        return [
            'account' => $book['account'],
            'statement_date' => $S,
            'rows' => $rows,
            'summary' => [
                'book_balance' => $bookBalance,
                'deposits_not_credited' => round($notCreditedDr, 2),
                'payments_not_debited' => round($notDebitedCr, 2),
                'in_bank_not_in_books' => round($bankOnlyDr - $bankOnlyCr, 2),
                'bank_balance_from_books' => $bankFromBooks,
                'statement_balance' => $statementBalance,
                'difference' => $statementBalance === null ? null : round($statementBalance - $bankFromBooks, 2),
                'entries_cleared' => $clearedByS,
            ],
            'locked_to' => $lockedTo,
            'history' => DB::table('bank_reconciliation_statements as s')->leftJoin('users as u', 'u.id', '=', 's.reconciled_by')
                ->where('s.company_id', $companyId)->where('s.account_id', $account->id)->orderByDesc('s.statement_date')
                ->get(['s.*', DB::raw("trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) as reconciled_by_name")]),
        ];
    }

    /**
     * Set (or clear, with null) the bank date of Bank Book entries. Refuses entries in a saved
     * reconciliation, and entries that are not in this account's book.
     *
     * @param array<int, array{journal_entry_id: string, bank_date: ?string}> $items
     */
    public function setBankDates(string $companyId, ChartOfAccount $account, array $items, string $userId): int
    {
        $ids = array_column($items, 'journal_entry_id');
        $entries = JournalEntry::where('company_id', $companyId)->whereIn('id', $ids)
            ->whereIn('id', JournalEntryItem::select('journal_entry_id')->where('account_id', $account->id))
            ->get(['id', 'entry_date', 'reference', 'entry_number'])->keyBy('id');
        $existing = DB::table('bank_clearings')->where('account_id', $account->id)->whereIn('journal_entry_id', $ids)->pluck('bank_date', 'journal_entry_id');
        $lockedTo = $this->lastCompleted($companyId, $account->id)?->statement_date;
        $today = now()->toDateString();

        foreach ($items as $item) {
            $entry = $entries->get($item['journal_entry_id']);
            if (!$entry) {
                throw new \InvalidArgumentException('One of the entries is not in this bank book. Reload the page and try again.');
            }
            $ref = $entry->reference ?: $entry->entry_number;
            $new = $item['bank_date'] ? Carbon::parse($item['bank_date'])->toDateString() : null;
            if ($new && $new > $today) {
                throw new \InvalidArgumentException("Bank date for {$ref} is in the future.");
            }
            $old = isset($existing[$entry->id]) ? Carbon::parse($existing[$entry->id])->toDateString() : null;
            $entryDate = $entry->entry_date->toDateString();
            if ($lockedTo && $entryDate <= $lockedTo && (($old && $old <= $lockedTo) || ($new && $new <= $lockedTo))) {
                if ($old !== $new) {
                    throw new \InvalidArgumentException("{$ref} is in the reconciliation saved up to " . Carbon::parse($lockedTo)->format('d/m/Y')
                        . '. Reopen that reconciliation to change it.');
                }
            }
        }

        DB::transaction(function () use ($items, $account, $companyId, $userId) {
            foreach ($items as $item) {
                if (!$item['bank_date']) {
                    DB::table('bank_clearings')->where('account_id', $account->id)->where('journal_entry_id', $item['journal_entry_id'])->delete();
                    continue;
                }
                DB::table('bank_clearings')->updateOrInsert(
                    ['account_id' => $account->id, 'journal_entry_id' => $item['journal_entry_id']],
                    ['id' => DB::table('bank_clearings')->where('account_id', $account->id)->where('journal_entry_id', $item['journal_entry_id'])->value('id') ?? (string) Str::uuid(),
                        'company_id' => $companyId, 'bank_date' => Carbon::parse($item['bank_date'])->toDateString(),
                        'cleared_by' => $userId, 'updated_at' => now(), 'created_at' => now()]
                );
            }
        });

        return count($items);
    }

    /** Save the reconciliation as at the statement date - only when it agrees with the statement. */
    public function complete(string $companyId, ChartOfAccount $account, string $statementDate, float $statementBalance, ?string $notes, string $userId): object
    {
        $last = $this->lastCompleted($companyId, $account->id);
        $S = Carbon::parse($statementDate)->toDateString();
        if ($S > now()->toDateString()) {
            throw new \InvalidArgumentException('The statement date cannot be in the future.');
        }
        if ($last && $S <= $last->statement_date) {
            throw new \InvalidArgumentException('This bank is already reconciled up to ' . Carbon::parse($last->statement_date)->format('d/m/Y')
                . '. Choose a later statement date, or reopen that reconciliation.');
        }
        $st = $this->statement($companyId, $account, $S, $statementBalance);
        $sum = $st['summary'];
        if (abs((float) $sum['difference']) >= 0.01) {
            throw new \InvalidArgumentException('The books do not agree with the statement yet: difference KES ' . number_format((float) $sum['difference'], 2)
                . '. Give each entry that went through the bank its bank date, and record anything on the statement that is missing from the books (bank charges, deposits...).');
        }

        $id = (string) Str::uuid();
        DB::table('bank_reconciliation_statements')->insert([
            'id' => $id, 'company_id' => $companyId, 'account_id' => $account->id, 'statement_date' => $S,
            'statement_balance' => $statementBalance, 'book_balance' => $sum['book_balance'],
            'deposits_not_credited' => $sum['deposits_not_credited'], 'payments_not_debited' => $sum['payments_not_debited'],
            'in_bank_not_in_books' => $sum['in_bank_not_in_books'], 'bank_balance_from_books' => $sum['bank_balance_from_books'],
            'difference' => $sum['difference'], 'entries_cleared' => $sum['entries_cleared'], 'notes' => $notes,
            'reconciled_by' => $userId, 'reconciled_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return DB::table('bank_reconciliation_statements')->find($id);
    }

    /** Reopen (delete) the latest saved reconciliation, unlocking its entries. */
    public function reopen(string $companyId, string $statementId): object
    {
        $s = DB::table('bank_reconciliation_statements')->where('company_id', $companyId)->find($statementId);
        if (!$s) {
            throw new \InvalidArgumentException('Reconciliation not found.');
        }
        $latest = $this->lastCompleted($companyId, $s->account_id);
        if ($latest && $latest->id !== $s->id) {
            throw new \InvalidArgumentException('Only the latest reconciliation (to ' . Carbon::parse($latest->statement_date)->format('d/m/Y') . ') can be reopened.');
        }
        DB::table('bank_reconciliation_statements')->where('id', $s->id)->delete();

        return $s;
    }
}
