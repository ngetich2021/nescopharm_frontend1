<?php

namespace App\Jobs\Etims;

use App\Models\Company;
use App\Models\Invoice;
use App\Services\TaxCompliance\EtimsItemSyncService;
use App\Services\TaxCompliance\EtimsSaleService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SubmitInvoiceToEtimsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 25;
    public int $backoff = 30;

    public function __construct(public readonly string $invoiceId)
    {
        $this->onQueue('etims');
    }

    /**
     * Prevent two workers from submitting the same invoice concurrently.
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("etims:invoice:{$this->invoiceId}"))
                ->releaseAfter(60)
                ->expireAfter(600),
        ];
    }

    public function handle(EtimsSaleService $service, EtimsItemSyncService $itemSync): void
    {
        $invoice = Invoice::find($this->invoiceId);
        if (!$invoice) {
            Log::info('SubmitInvoiceToEtimsJob: invoice gone', ['invoice_id' => $this->invoiceId]);
            return;
        }

        // Already completed via webhook arriving before we got here? Done.
        if ($invoice->etims_status === 'completed') {
            return;
        }

        $company = Company::find($invoice->company_id);
        if (! $company) {
            $invoice->update([
                'etims_status' => 'failed',
                'etims_last_error' => 'The invoice company could not be found.',
            ]);

            return;
        }

        // Callbacks are optional in DigiTax. Poll a submitted sale until KRA
        // completes it so invoice processing does not depend on callback URL
        // validation or webhook delivery.
        if ($invoice->etims_status === 'submitted' && $invoice->etims_sale_id) {
            $result = $service->refreshInvoice($invoice);
            if (! $result || in_array($result->status, ['pending', 'failed'], true)) {
                $this->release($this->backoff);
            }

            return;
        }

        $items = $itemSync->prepareInvoiceProducts($company, $invoice);
        if ($items['status'] !== 'ready') {
            $invoice->update([
                'etims_status' => $items['status'] === 'pending' ? 'registering_items' : 'failed',
                'etims_lock_state' => null,
                'etims_lock_acquired_at' => null,
                'etims_last_error' => $items['status'] === 'failed' ? $items['message'] : null,
            ]);

            if ($items['retryable']) {
                $this->release($this->backoff);
            }

            return;
        }

        $result = $service->submitInvoice($invoice);
        if (! $result || in_array($result->status, ['pending', 'failed'], true)) {
            $this->release($this->backoff);
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error('SubmitInvoiceToEtimsJob exhausted retries', [
            'invoice_id' => $this->invoiceId,
            'error' => $e->getMessage(),
        ]);

        $invoice = Invoice::find($this->invoiceId);
        if ($invoice) {
            $invoice->update([
                'etims_status' => 'failed',
                'etims_lock_state' => null,
                'etims_last_error' => 'Retries exhausted: ' . $e->getMessage(),
            ]);
        }
    }
}
