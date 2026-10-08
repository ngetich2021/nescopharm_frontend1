<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // [alert type, alert data key, table, status column, values that still await a decision]
        $map = [
            ['purchase_order_pending', 'purchase_order_id', 'purchase_orders', 'approval_status', ['pending']],
            ['requisition_pending', 'requisition_id', 'requisitions', 'approval_status', ['pending', 'in_review']],
            ['expense_pending', 'expense_id', 'expenses', 'status', ['pending']],
            ['breakage_pending', 'breakage_id', 'breakages', 'approval_status', ['pending']],
            ['stock_adjustment_pending', 'stock_adjustment_id', 'stock_adjustments', 'status', ['pending']],
            ['dispatch_pending', 'dispatch_id', 'order_dispatches', 'approval_status', ['pending', 'in_progress']],
            ['workflow_step_pending', 'step_instance_id', 'approval_workflow_step_instances', 'status', ['pending']],
        ];

        foreach ($map as [$type, $key, $table, $column, $pending]) {
            $placeholders = implode(',', array_fill(0, count($pending), '?'));
            DB::statement(
                "DELETE FROM notifications n
                 WHERE n.data::jsonb->>'type' = ?
                   AND NOT EXISTS (
                       SELECT 1 FROM {$table} t
                       WHERE t.id::text = n.data::jsonb->>?
                         AND t.{$column} IN ({$placeholders})
                   )",
                array_merge([$type, $key], $pending),
            );
        }
    }

    public function down(): void
    {
    }
};
