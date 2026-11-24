<?php

namespace App\Console\Commands;

use App\Services\OrderDeletionService;
use Illuminate\Console\Command;

/**
 * Used to delete rejected orders after an hour and cancelled ones after 24 hours. Since
 * 24/11/2026 orders and invoices are never deleted, so declined orders stay on record with
 * their status; this command is kept only so an old schedule entry finds it, and does nothing.
 */
class PurgeDeclinedOrders extends Command
{
    protected $signature = 'orders:purge-declined';
    protected $description = 'No longer deletes anything: orders and invoices are never deleted';

    public function handle(): int
    {
        $this->info(OrderDeletionService::NO_DELETE_MESSAGE);

        return self::SUCCESS;
    }
}
