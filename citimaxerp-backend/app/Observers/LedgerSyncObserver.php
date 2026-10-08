<?php

namespace App\Observers;

use App\Models\Invoice;
use App\Models\OrderDispatch;
use App\Models\OrderDispatchItem;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PayrollPayslip;
use App\Models\PayrollRun;
use App\Models\ProductReceipt;
use App\Models\ProductReceiptItem;
use App\Services\LedgerPostingService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Keeps the general ledger in step with business documents. Work is deferred
 * until the surrounding transaction commits (so line items exist and a
 * rollback never leaves orphan entries) and de-duplicated per document, so a
 * receipt saved with 20 items posts once, not 20 times.
 */
class LedgerSyncObserver
{
    protected static array $queued = [];

    public function saved(Model $model): void
    {
        $this->route($model, false);
    }

    public function deleted(Model $model): void
    {
        $this->route($model, true);
    }

    protected function route(Model $model, bool $deleted): void
    {
        match (true) {
            $model instanceof ProductReceiptItem => $this->queueById(ProductReceipt::class, $model->product_receipt_id),
            $model instanceof OrderDispatchItem => $this->queueById(OrderDispatch::class, $model->order_dispatch_id),
            $model instanceof PaymentAllocation => $this->queueById(Payment::class, $model->payment_id),
            $model instanceof PayrollPayslip => $this->queueById(PayrollRun::class, $model->payroll_run_id),
            default => $this->queue($model, $deleted),
        };

        // A receipt taken before its order was invoiced was posted as a cash
        // sale; once the invoice exists it should clear receivables instead.
        if ($model instanceof Invoice && $model->order_id && $model->wasRecentlyCreated) {
            Payment::where('order_id', $model->order_id)->pluck('id')
                ->each(fn ($id) => $this->queueById(Payment::class, $id));
        }
    }

    protected function queueById(string $class, ?string $id): void
    {
        if (!$id) {
            return;
        }
        $model = $class::find($id);
        if ($model) {
            $this->queue($model, false);
        }
    }

    protected function queue(Model $model, bool $deleted): void
    {
        $key = get_class($model) . ':' . $model->getKey();
        if (isset(self::$queued[$key]) && !$deleted) {
            return;
        }
        self::$queued[$key] = true;

        DB::afterCommit(function () use ($model, $deleted, $key) {
            unset(self::$queued[$key]);
            $fresh = $deleted ? null : $model->fresh();

            try {
                app(LedgerPostingService::class)->syncModel($fresh ?? $model, $fresh === null);
            } catch (\Throwable $e) {
                // Never fail the business transaction over bookkeeping; the
                // document can be re-posted with `php artisan finance:backfill`.
                Log::error('Ledger sync failed', [
                    'document' => $key,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
