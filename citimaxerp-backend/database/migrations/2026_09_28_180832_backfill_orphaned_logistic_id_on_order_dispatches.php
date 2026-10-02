<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Before the LogisticController::store() fix, dispatching an order created a
 * `logistics` row (linked via logistics.order_dispatch_id) but never wrote
 * order_dispatches.logistic_id back - so OrderDispatch::logistic() (a
 * belongsTo keyed on logistic_id) resolved to null even though a real
 * logistic record with driver/tracking/delivery-address existed. That made
 * the dispatch details UI show "Not assigned" and offered "Dispatch Order"
 * again for orders already out for delivery. This repairs the orphaned rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        $orphaned = DB::table('order_dispatches')
            ->join('logistics', 'logistics.order_dispatch_id', '=', 'order_dispatches.id')
            ->whereNull('order_dispatches.logistic_id')
            ->select('order_dispatches.id as dispatch_id', 'logistics.id as logistic_id')
            ->get();

        foreach ($orphaned as $row) {
            DB::table('order_dispatches')
                ->where('id', $row->dispatch_id)
                ->update(['logistic_id' => $row->logistic_id]);
        }
    }

    /**
     * Data repair - not reversible (the correct state IS the linked state).
     */
    public function down(): void
    {
        //
    }
};
