<?php

namespace App\Observers;

use App\Jobs\Etims\SubmitInvoiceToEtimsJob;
use App\Models\CompanyEtimsConfig;
use App\Models\Invoice;
use Illuminate\Support\Facades\Log;

/**
 * Fires eTIMS submission when an invoice is explicitly approved for a Kenyan
 * company whose eTIMS is confirmed Live, on/after go-live. On Test an invoice
 * goes to KRA only through Send to eTIMS.
 *
 * Idempotency: we never re-dispatch if etims_status is already terminal.
 */
class InvoiceObserver
{
    // Citimax issues invoices when they are sent; this is the semantic
    // equivalent of JH ERP's approved state.
    private const ISSUED_STATUSES = ['sent', 'paid'];

    public function updated(Invoice $invoice): void
    {
        if (! $invoice->wasChanged('status')) {
            return;
        }
        if (! in_array($invoice->status, self::ISSUED_STATUSES, true)) {
            return;
        }
        $this->maybeDispatch($invoice);
    }

    public function created(Invoice $invoice): void
    {
        if (in_array($invoice->status, self::ISSUED_STATUSES, true)) {
            $this->maybeDispatch($invoice);
        }
    }

    private function maybeDispatch(Invoice $invoice): void
    {
        // Credit notes have a different DigiTax contract and must be submitted
        // through EtimsCreditNoteService with their original sale reference.
        if ($invoice->type === 'credit_note') {
            return;
        }

        if (! $invoice->etims_requested) {
            return;
        }

        // Already submitted/completed
        if (in_array($invoice->etims_status, ['submitted', 'completed'], true)) {
            return;
        }
        // Currently being processed
        if ($invoice->etims_lock_state === 'locked_pending') {
            return;
        }

        $config = CompanyEtimsConfig::query()
            ->where('company_id', $invoice->company_id)
            ->where('country_code', 'KE')
            ->live()
            ->first();

        if (! $config) {
            return;   // company not live on eTIMS - nothing to do
        }

        if ($config->go_live_date && $invoice->invoice_date && $invoice->invoice_date->lt($config->go_live_date)) {
            // Invoice predates go-live - per plan we don't backfill historical invoices
            return;
        }

        Log::info('Dispatching SubmitInvoiceToEtimsJob', [
            'invoice_id' => $invoice->id,
            'company_id' => $invoice->company_id,
        ]);
        // Straight away once saved (no worker runs the etims queue); the eTIMS invoice page takes it on from there.
        \Illuminate\Support\Facades\DB::afterCommit(fn () => SubmitInvoiceToEtimsJob::runNow((string) $invoice->id));
    }
}
