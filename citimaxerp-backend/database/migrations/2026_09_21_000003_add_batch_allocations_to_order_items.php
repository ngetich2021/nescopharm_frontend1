<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshot of which inventory_batches (batch_number, expiry_date,
     * quantity) a FEFO allocation drew from for this line, e.g.
     * [{"batch_id":"...","batch_number":"BATCH-...","quantity":5,"expiry_date":"2026-12-01"}].
     * A single order/dispatch line can span more than one batch once the
     * nearest-to-expiry batch runs out mid-line, hence an array rather than
     * a single batch_id column.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->jsonb('batch_allocations')->nullable()->after('packaging_breakdown');
        });

        Schema::table('order_dispatch_items', function (Blueprint $table) {
            $table->jsonb('batch_allocations')->nullable()->after('packaging_breakdown');
        });
    }

    public function down(): void
    {
        Schema::table('order_dispatch_items', function (Blueprint $table) {
            $table->dropColumn('batch_allocations');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('batch_allocations');
        });
    }
};
