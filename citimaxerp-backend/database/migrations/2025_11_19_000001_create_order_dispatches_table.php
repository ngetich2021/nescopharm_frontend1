<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('order_dispatches', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('dispatch_number')->unique();
            $table->uuid('order_id');
            $table->uuid('company_id');
            $table->uuid('from_store_id')->nullable();
            $table->uuid('delivery_location_id')->nullable();

            // Approval workflow fields
            $table->enum('approval_status', ['draft', 'pending', 'in_progress', 'approved', 'rejected'])->default('pending');
            $table->uuid('workflow_instance_id')->nullable();

            // Delivery logistics reference
            $table->uuid('logistic_id')->nullable();

            // Dispatch details
            $table->enum('status', ['pending', 'approved', 'in_transit', 'delivered', 'cancelled'])->default('pending');
            $table->timestamp('dispatch_date')->nullable();
            $table->timestamp('estimated_delivery_date')->nullable();
            $table->timestamp('actual_delivery_date')->nullable();

            // Additional info
            $table->text('notes')->nullable();
            $table->text('special_instructions')->nullable();
            $table->uuid('created_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->timestamps();

            // Foreign keys
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('from_store_id')->references('id')->on('stores')->onDelete('set null');
            $table->foreign('delivery_location_id')->references('id')->on('delivery_locations')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('workflow_instance_id')->references('id')->on('approval_workflow_instances')->onDelete('set null');

            // Indexes
            $table->index('order_id', 'idx_order_dispatches_order_id');
            $table->index('company_id', 'idx_order_dispatches_company_id');
            $table->index('approval_status', 'idx_order_dispatches_approval_status');
            $table->index('status', 'idx_order_dispatches_status');
            $table->index('dispatch_date', 'idx_order_dispatches_dispatch_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_dispatches');
    }
};
