<?php

use App\Models\PurchaseOrder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * PurchaseOrderController never computed total_amount from the order's
     * items (see the accompanying controller fix) - every existing PO is
     * stuck at its column default of 0. Backfill them once so "amount owed"
     * displays correctly for orders created before that fix.
     */
    public function up(): void
    {
        PurchaseOrder::withoutEvents(function () {
            PurchaseOrder::query()->chunkById(200, function ($purchaseOrders) {
                foreach ($purchaseOrders as $purchaseOrder) {
                    $itemsTotal = (float) $purchaseOrder->items()->sum('subtotal');
                    $totalAmount = max(0, $itemsTotal
                        + (float) $purchaseOrder->shipping_cost
                        + (float) $purchaseOrder->logistics_cost
                        - (float) $purchaseOrder->discount);

                    $amountPaid = (float) $purchaseOrder->amount_paid;
                    $status = 'unpaid';
                    if ($totalAmount > 0 && $amountPaid >= $totalAmount) {
                        $status = 'paid';
                    } elseif ($amountPaid > 0) {
                        $status = 'partial';
                    }

                    $purchaseOrder->update([
                        'total_amount' => $totalAmount,
                        'payment_status' => $status,
                    ]);
                }
            });
        });
    }

    public function down(): void
    {
        // Not reversible - the pre-fix state (all zeros) was itself the bug.
    }
};
