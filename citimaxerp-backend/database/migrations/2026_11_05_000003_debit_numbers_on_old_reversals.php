<?php

use App\Models\Invoice;
use App\Models\JournalEntry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A reversal is posted against the entry it undoes, not the invoice, so the ledger cannot swap in a
 * debit's current number for it. Its text is corrected here (only the wording; no amounts).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $debits = DB::table('invoices')
                ->where('invoice_number', 'like', Invoice::DEBIT_PREFIX . '%')
                ->whereRaw("metadata->>'previous_number' is not null")
                ->get(['id', 'invoice_number', 'metadata']);

            foreach ($debits as $debit) {
                $old = Invoice::shortNumber(json_decode((string) $debit->metadata, true)['previous_number']);
                $now = Invoice::shortNumber($debit->invoice_number);
                // Whole numbers only: INV-0014 must not touch INV-00145.
                $swap = fn (?string $text) => preg_replace('/(?<![A-Za-z0-9])' . preg_quote($old, '/') . '(?![A-Za-z0-9])/', $now, (string) $text);

                $reversals = DB::table('journal_entries as reversal')
                    ->join('journal_entries as original', DB::raw('original.id::text'), '=', DB::raw('reversal.source_id::text'))
                    ->where('reversal.source_type', JournalEntry::class)
                    ->where('original.source_type', Invoice::class)
                    ->whereRaw('original.source_id::text = ?', [$debit->id])
                    ->get(['reversal.id', 'reversal.description']);

                foreach ($reversals as $reversal) {
                    DB::table('journal_entries')->where('id', $reversal->id)->update(['description' => $swap($reversal->description)]);
                    foreach (DB::table('journal_entry_items')->where('journal_entry_id', $reversal->id)->get(['id', 'description']) as $item) {
                        DB::table('journal_entry_items')->where('id', $item->id)->update(['description' => $swap($item->description)]);
                    }
                }
            }
        });
    }

    public function down(): void
    {
        // Wording only, and the old number no longer means anything: nothing to undo.
    }
};
