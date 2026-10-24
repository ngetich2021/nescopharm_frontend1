<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderDeletionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class PurgeDeclinedOrders extends Command
{
    protected $signature = 'orders:purge-declined';
    protected $description = 'Delete orders rejected over an hour ago and orders cancelled (and not restored) over 24 hours ago';

    public function handle(OrderDeletionService $deletion): int
    {
        $due = Order::where(fn ($q) => $q
                ->where(fn ($q) => $q->where('status', 'rejected')->where('rejected_at', '<=', now()->subMinutes(Order::REJECTED_KEEP_MINUTES)))
                ->orWhere(fn ($q) => $q->where('status', 'cancelled')->where('cancelled_at', '<=', now()->subHours(Order::CANCELLED_KEEP_HOURS))))
            ->get();

        $deleted = 0;
        foreach ($due as $order) {
            if ($blocker = $deletion->blocker($order)) {
                Log::warning('Declined order not purged', ['order' => $order->order_number, 'reason' => $blocker]);
                continue;
            }
            $deletion->delete($order);
            $deleted++;
        }
        $this->info("Declined orders deleted: {$deleted}");

        return self::SUCCESS;
    }
}
