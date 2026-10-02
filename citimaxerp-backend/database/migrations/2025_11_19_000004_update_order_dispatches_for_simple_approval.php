<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add 'draft' to status enum
        DB::statement("ALTER TABLE order_dispatches DROP CONSTRAINT IF EXISTS order_dispatches_status_check");
        DB::statement("ALTER TABLE order_dispatches ADD CONSTRAINT order_dispatches_status_check CHECK (status IN ('draft', 'pending', 'approved', 'in_transit', 'delivered', 'cancelled'))");
        
        Schema::table('order_dispatches', function (Blueprint $table) {
            // Add new approvers field
            $table->jsonb('approvers')->nullable()->after('delivery_location_id');
            
            // Remove workflow-related fields
            $table->dropForeign(['workflow_instance_id']);
            $table->dropColumn(['workflow_instance_id', 'approved_by']);
            
            // Rename approved_at to final_approved_at for clarity
            $table->renameColumn('approved_at', 'final_approved_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_dispatches', function (Blueprint $table) {
            // Remove approvers field
            $table->dropColumn('approvers');
            
            // Re-add workflow fields
            $table->uuid('workflow_instance_id')->nullable();
            $table->uuid('approved_by')->nullable();
            
            // Rename back
            $table->renameColumn('final_approved_at', 'approved_at');
            
            // Re-add foreign keys
            $table->foreign('workflow_instance_id')->references('id')->on('approval_workflow_instances')->onDelete('set null');
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
        });
    }
};
