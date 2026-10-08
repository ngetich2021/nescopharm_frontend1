<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Account balances computed in a single grouped query rather than one query
 * per account. Used by the finance dashboard and the chart-of-accounts list.
 */
class LedgerBalanceService
{
    /**
     * Debit/credit movement per account id for a company.
     *
     * @return Collection<string, object{debit: float, credit: float}>
     */
    public function movements(string $companyId, ?string $from = null, ?string $to = null): Collection
    {
        return DB::table('journal_entry_items as i')
            ->join('journal_entries as e', 'e.id', '=', 'i.journal_entry_id')
            ->where('e.company_id', $companyId)
            ->whereIn('e.status', JournalEntry::LEDGER_STATUSES)
            ->when($from, fn ($q) => $q->where('e.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->where('e.entry_date', '<=', $to))
            ->groupBy('i.account_id')
            ->select('i.account_id', DB::raw('SUM(i.debit_amount) as debit'), DB::raw('SUM(i.credit_amount) as credit'))
            ->get()
            ->keyBy('account_id');
    }

    /**
     * Balance per account in its normal direction (positive = normal), including
     * opening balances, as of $asOf.
     *
     * @return Collection<string, float>
     */
    public function balances(string $companyId, ?string $asOf = null, ?Collection $accounts = null): Collection
    {
        $accounts ??= ChartOfAccount::where('company_id', $companyId)->get();
        $moves = $this->movements($companyId, null, $asOf);

        return $accounts->mapWithKeys(function (ChartOfAccount $account) use ($moves) {
            $m = $moves->get($account->id);
            $debit = (float) ($m->debit ?? 0);
            $credit = (float) ($m->credit ?? 0);
            $net = $account->normal_balance === 'credit' ? $credit - $debit : $debit - $credit;
            return [$account->id => round((float) $account->opening_balance + $net, 2)];
        });
    }

    /**
     * Debit-minus-credit total for a set of accounts (opening balances
     * included, signed by their normal side).
     */
    public function signedTotal(Collection $accounts, Collection $balances, string $side): float
    {
        return round($accounts->sum(function (ChartOfAccount $account) use ($balances, $side) {
            $balance = (float) ($balances->get($account->id) ?? 0);
            // Contra accounts (e.g. accumulated depreciation under assets) carry
            // the opposite normal balance and therefore reduce their group.
            return $account->normal_balance === $side ? $balance : -$balance;
        }), 2);
    }
}
