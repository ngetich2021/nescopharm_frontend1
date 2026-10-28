<?php

use App\Models\Cheque;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Payment;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Receipts of cheques that bounced were reversed on the day they were marked bounced. Date each
 * reversal on the bounce date instead (the date of its bounced cheque charges), so the bounce
 * and the charge sit together in the ledger. Also name the charge entries after their cheque.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Name each bounced cheque charges entry after its cheque.
        Cheque::where('direction', 'received')
            ->where('status', 'bounced')
            ->whereNotNull('bounce_charge_invoice_id')
            ->get()
            ->each(function (Cheque $cheque) {
                $number = Invoice::find($cheque->bounce_charge_invoice_id)?->invoice_number;
                DB::table('journal_entries')
                    ->where('source_type', Invoice::class)
                    ->where('source_id', $cheque->bounce_charge_invoice_id)
                    ->where('status', 'posted')
                    ->update(['description' => "Bounced cheque charges {$number} - cheque {$cheque->cheque_number}"]);
            });

        Cheque::where('direction', 'received')
            ->where('status', 'bounced')
            ->whereNotNull('payment_id')
            ->get()
            ->each(function (Cheque $cheque) {
                // The last receipt entry is the one the bounce reversed; earlier ones were edits.
                $receipts = JournalEntry::where('source_type', Payment::class)
                    ->where('source_id', $cheque->payment_id)
                    ->where('status', 'reversed')
                    ->latest('created_at')
                    ->limit(1)
                    ->get();

                foreach ($receipts as $receipt) {
                    $reversal = JournalEntry::where('source_type', JournalEntry::class)
                        ->where('source_id', $receipt->id)
                        ->where('status', 'posted')
                        ->latest('created_at')
                        ->first();
                    if (!$reversal) {
                        continue;
                    }

                    $reason = "Cheque {$cheque->cheque_number} bounced";
                    DB::table('journal_entries')->where('id', $reversal->id)->update([
                        'entry_date' => $cheque->bounceDate(),
                        'description' => "Reversal of {$receipt->entry_number}: {$reason}",
                        'metadata' => json_encode(array_merge($reversal->metadata ?? [], ['reversal_reason' => $reason])),
                    ]);
                    DB::table('journal_entries')->where('id', $receipt->id)->update(['reversal_reason' => $reason]);
                }
            });
    }

    public function down(): void
    {
        // Dates only; nothing to undo.
    }
};
