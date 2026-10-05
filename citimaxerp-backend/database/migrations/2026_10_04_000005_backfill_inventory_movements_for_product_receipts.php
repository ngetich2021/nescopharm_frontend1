<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Receipts saved before receipts wrote to the movement ledger show as 0 received in stock reports.
    // Before/after quantities can't be reconstructed for these, so they are left at 0.
    public function up(): void
    {
        DB::statement("
            INSERT INTO inventory_movements
                (id, company_id, store_id, product_id, variant_id, type, quantity, quantity_before, quantity_after,
                 reference_type, reference_id, reference_number, unit_cost, unit_price, total_cost,
                 movement_date, created_by, notes, created_at, updated_at)
            SELECT gen_random_uuid(), r.company_id, r.store_id, i.product_id, i.variant_id, 'receipt', i.quantity, 0, 0,
                   'product_receipt', r.id, r.product_receipt_number, i.unit_price, i.unit_price, ROUND(i.quantity * i.unit_price, 2),
                   r.created_at, r.received_by, 'Backfilled from product receipt', NOW(), NOW()
            FROM product_receipt_items i
            JOIN product_receipts r ON r.id = i.product_receipt_id
            WHERE i.product_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM inventory_movements m
                  WHERE m.reference_type = 'product_receipt' AND m.reference_id = r.id
              )
        ");
    }

    public function down(): void
    {
        DB::table('inventory_movements')->where('notes', 'Backfilled from product receipt')->delete();
    }
};
