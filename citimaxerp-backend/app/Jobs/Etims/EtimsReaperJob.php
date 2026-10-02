<?php

namespace App\Jobs\Etims;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled every 5 minutes (via Kernel) - finds invoices that have been
 * locked_pending for >15 min (worker likely crashed or callback never arrived)
 * and resets their state so the user can retry.
 */
class EtimsReaperJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;

    public function __construct() {
        $this->onQueue('etims');
    }

    public function handle(): void
    {
        $threshold = now()->subMinutes((int) config('tax_compliance.etims.reaper.lock_timeout_minutes', 15));

        $reaped = Invoice::query()
            ->where('etims_lock_state', 'locked_pending')
            ->whereNotNull('etims_lock_acquired_at')
            ->where('etims_lock_acquired_at', '<', $threshold)
            ->get();

        foreach ($reaped as $invoice) {
            // Don't reap if we already received the completion webhook
            if (in_array($invoice->etims_status, ['completed', 'voided_with_cn'], true)) {
                $invoice->update(['etims_lock_state' => null]);
                continue;
            }

            $invoice->update([
                'etims_lock_state' => null,
                'etims_status' => 'failed',
                'etims_last_error' => 'Stuck lock reaped after ' . $threshold->diffForHumans(now()),
            ]);

            Log::warning('eTIMS reaper reset stuck lock', [
                'invoice_id' => $invoice->id,
                'company_id' => $invoice->company_id,
                'locked_at' => $invoice->etims_lock_acquired_at?->toIso8601String(),
            ]);
        }
    }
}
