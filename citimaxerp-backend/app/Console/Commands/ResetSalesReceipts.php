<?php

namespace App\Console\Commands;

use App\Models\CreditNote;
use App\Models\CreditNoteRefund;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Services\CreditNoteService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-off for the move off the old system: wipes customer receipts and/or credit notes so they
 * can be entered afresh. Invoices and orders stay; their paid / credited amounts go back to
 * zero, and the ledger entries of what was removed are deleted outright (with any reversals),
 * not reversed, so the books read as if those documents were never entered.
 */
class ResetSalesReceipts extends Command
{
    protected $signature = 'sales:reset-receipts
        {--payments : Delete every customer receipt (payments, allocations, refunds, received cheques)}
        {--credit-notes : Delete every credit note (credit off invoices, returned stock taken back out)}
        {--company= : Only this company id}
        {--force : Actually write; without it the command only reports what it would do}';

    protected $description = 'Delete all customer receipts and/or credit notes so they can be re-entered';

    public function handle(CreditNoteService $creditNotes): int
    {
        if (!$this->option('payments') && !$this->option('credit-notes')) {
            $this->error('Say what to reset: --payments and/or --credit-notes');
            return self::FAILURE;
        }
        $company = $this->option('company');
        $scope = fn ($q) => $company ? $q->where('company_id', $company) : $q;
        $write = (bool) $this->option('force');

        if ($this->option('payments')) {
            $payments = $scope(Payment::query());
            $this->line(sprintf('Receipts: %d (KES %s)', (clone $payments)->count(), number_format((float) (clone $payments)->sum('amount_paid'), 2)));
            $this->line('Received cheques: ' . $scope(DB::table('cheques')->where('direction', 'received'))->count());
        }
        if ($this->option('credit-notes')) {
            $notes = $scope(CreditNote::query());
            $this->line(sprintf('Credit notes: %d (KES %s)', (clone $notes)->count(), number_format((float) (clone $notes)->sum('total_amount'), 2)));
        }
        if (!$write) {
            $this->warn('Dry run: nothing changed. Add --force to delete.');
            return self::SUCCESS;
        }

        if ($this->option('credit-notes')) {
            // One by one through the service so each note's stock comes back out and its invoices let go.
            foreach ($scope(CreditNote::query())->get() as $note) {
                $creditNotes->delete($note);
            }
        }

        DB::transaction(function () use ($scope) {
            if ($this->option('payments')) {
                $ids = $scope(Payment::query())->pluck('id');
                foreach ($ids->chunk(500) as $chunk) {
                    if (Schema::hasTable('mpesa_transactions')) {
                        DB::table('mpesa_transactions')->whereIn('payment_id', $chunk)->update(['payment_id' => null]);
                    }
                    DB::table('invoices')->whereIn('payment_id', $chunk)->update(['payment_id' => null]);
                    DB::table('payment_refunds')->whereIn('payment_id', $chunk)->delete();
                    DB::table('payment_allocations')->whereIn('payment_id', $chunk)->delete();
                    DB::table('payments')->whereIn('id', $chunk)->delete();
                }
                $scope(DB::table('cheques')->where('direction', 'received'))->delete();
                $scope(DB::table('invoices'))->update(['amount_paid' => 0]);
                $scope(DB::table('orders'))->update(['amount_paid' => 0]);
                $this->purgeLedger([Payment::class, PaymentAllocation::class, PaymentRefund::class], $scope);
            }
            if ($this->option('credit-notes')) {
                $scope(DB::table('invoices'))->update(['amount_credited' => 0]);
                $this->purgeLedger([CreditNote::class, CreditNoteRefund::class], $scope);
            }

            // Balance, status and the order's payment status follow from what is left.
            $scope(DB::table('invoices'))->update(['balance_amount' => DB::raw('total_amount - amount_paid - amount_credited')]);
            $scope(DB::table('invoices'))->whereNotIn('status', ['draft', 'cancelled', 'void'])->update([
                'status' => DB::raw("CASE
                    WHEN balance_amount <= 0.005 AND amount_paid >= total_amount - 0.005 THEN 'paid'
                    WHEN balance_amount <= 0.005 THEN 'credited'
                    WHEN amount_paid + amount_credited > 0 THEN 'partially_paid'
                    WHEN due_date < CURRENT_DATE THEN 'overdue'
                    ELSE 'sent' END"),
                'paid_at' => DB::raw("CASE WHEN balance_amount <= 0.005 THEN paid_at END"),
            ]);
            $scope(DB::table('orders'))->update([
                'payment_status' => DB::raw("CASE
                    WHEN EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = orders.id AND i.balance_amount <= 0.005 AND i.total_amount > 0) THEN 'paid'
                    WHEN EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = orders.id AND i.amount_paid + i.amount_credited > 0) THEN 'partial'
                    ELSE 'unpaid' END"),
            ]);
        });

        $this->info('Done.');
        return self::SUCCESS;
    }

    // Journal entries posted for these documents, and the reversals of them.
    protected function purgeLedger(array $sourceTypes, callable $scope): void
    {
        $entryIds = $scope(DB::table('journal_entries'))->whereIn('source_type', $sourceTypes)->pluck('id');
        $reversalIds = $entryIds->chunk(500)->flatMap(fn ($chunk) => DB::table('journal_entries')
            ->where('source_type', \App\Models\JournalEntry::class)->whereIn('source_id', $chunk)->pluck('id'));
        foreach ($entryIds->merge($reversalIds)->chunk(500) as $chunk) {
            DB::table('journal_entry_items')->whereIn('journal_entry_id', $chunk)->delete();
            DB::table('journal_entries')->whereIn('id', $chunk)->delete();
        }
        $this->line('Ledger entries removed: ' . ($entryIds->count() + $reversalIds->count()));
    }
}
