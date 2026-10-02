<?php

namespace App\Console\Commands;

use App\Models\InventoryBatch;
use Illuminate\Console\Command;

class RefreshInventoryBatchStatuses extends Command
{
    protected $signature = 'batches:refresh-status';
    protected $description = 'Flip inventory batch status to expired/sold_out as their expiry date passes or stock runs out - status is otherwise only updated reactively when a batch is touched, so it can drift stale without this.';

    public function handle(): int
    {
        $expired = InventoryBatch::where('status', 'active')
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<', now()->toDateString())
            ->update(['status' => 'expired']);

        // Expired takes priority over sold_out - only reclassify batches
        // that are still 'active' (i.e. not expired) and have run out.
        $soldOut = InventoryBatch::where('status', 'active')
            ->where('quantity_available', '<=', 0)
            ->where('quantity_allocated', '<=', 0)
            ->update(['status' => 'sold_out']);

        // A batch that was marked sold_out or expired can become active again
        // if stock was restored (e.g. an order that consumed it got edited
        // or deleted) and it hasn't actually expired.
        $reactivated = InventoryBatch::whereIn('status', ['sold_out'])
            ->where(function ($q) {
                $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', now()->toDateString());
            })
            ->where(function ($q) {
                $q->where('quantity_available', '>', 0)->orWhere('quantity_allocated', '>', 0);
            })
            ->update(['status' => 'active']);

        $this->info("Batch status refresh: {$expired} expired, {$soldOut} sold out, {$reactivated} reactivated.");

        return self::SUCCESS;
    }
}
