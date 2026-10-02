<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Cheques were customer-received-only until now. This extends the same
     * table/workflow to also track post-dated cheques ISSUED to suppliers
     * (or refund cheques issued to clients), so a single maturity-reminder
     * job can cover both directions.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE cheques ALTER COLUMN customer_id DROP NOT NULL');

        Schema::table('cheques', function (Blueprint $table) {
            $table->string('direction', 20)->default('received')->after('company_id');
            $table->uuid('supplier_id')->nullable()->after('customer_id');
            $table->uuid('purchase_order_id')->nullable()->after('invoice_id');
            // Dedupes the 7-day-before-maturity alert to MD/GM.
            $table->timestamp('reminder_sent_at')->nullable()->after('approved_at');

            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('set null');
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->onDelete('set null');
        });

        DB::statement("ALTER TABLE cheques ADD CONSTRAINT cheques_direction_check CHECK (direction IN ('received','issued'))");
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            DB::statement('ALTER TABLE cheques DROP CONSTRAINT IF EXISTS cheques_direction_check');
            $table->dropForeign(['supplier_id']);
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn(['direction', 'supplier_id', 'purchase_order_id', 'reminder_sent_at']);
        });

        DB::statement('ALTER TABLE cheques ALTER COLUMN customer_id SET NOT NULL');
    }
};
