<?php

use App\Models\Invoice;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Bounced cheque charges become debits numbered DEB-001, DEB-002... from the earliest to date, out
 * of the invoice sequence. Their amounts, dates and receipts are unchanged. The ledger keeps the
 * number each was posted under and shows the current one (JournalEntry::withCurrentNumbers), so it
 * is written straight to the table, without re-syncing the ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $charges = DB::table('invoices as i')
                ->join('cheques as c', 'c.bounce_charge_invoice_id', '=', 'i.id')
                ->where('i.invoice_number', 'not like', Invoice::DEBIT_PREFIX . '%')
                ->orderBy('i.invoice_date')
                ->orderBy('i.created_at')
                ->get(['i.id', 'i.company_id', 'i.invoice_number', 'i.metadata']);

            foreach ($charges as $charge) {
                $metadata = json_decode((string) $charge->metadata, true) ?: [];
                DB::table('invoices')->where('id', $charge->id)->update([
                    'invoice_number' => Invoice::nextDebitNumber($charge->company_id),
                    'file_number' => null,
                    'filed_at' => null,
                    'filed_by' => null,
                    'metadata' => json_encode($metadata + ['previous_number' => $charge->invoice_number]),
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            $debits = DB::table('invoices')->where('invoice_number', 'like', Invoice::DEBIT_PREFIX . '%')->get(['id', 'metadata']);

            foreach ($debits as $debit) {
                $metadata = json_decode((string) $debit->metadata, true) ?: [];
                if (!empty($metadata['previous_number'])) {
                    $previous = $metadata['previous_number'];
                    unset($metadata['previous_number']);
                    DB::table('invoices')->where('id', $debit->id)->update(['invoice_number' => $previous, 'metadata' => json_encode($metadata)]);
                }
            }
        });
    }
};
