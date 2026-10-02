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
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('order_number', 20)->unique();
            $table->uuid('customer_id');
            $table->decimal('total_amount', 10, 2);
            $table->string('status', 20)->default('pending');
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->uuid('company_id')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('discount')->nullable();
            $table->decimal('final_amount')->nullable();
            $table->uuid('delivery_location_id')->nullable();
            $table->text('tracking_number')->nullable();
            $table->decimal('amount_paid')->nullable();
            $table->string('currency')->nullable();
            $table->string('payment_status')->nullable();
            $table->boolean('below_minimum_price')->default(false);
            $table->boolean('requires_approval')->default(false);
            $table->timestamp('deleted_at')->nullable();
            $table->foreign('customer_id', 'orders_customer_id_fkey')->references('id')->on('customers');
            $table->foreign('company_id', 'orders_company_id_fkey')->references('id')->on('companies');
            $table->foreign('delivery_location_id', 'fk_delivery_location')->references('id')->on('delivery_locations')->onDelete('set null');
            
            $table->index('company_id', 'idx_orders_company_id');
            $table->index('order_number', 'idx_orders_order_number');
            $table->index('customer_id', 'idx_orders_customer_id');
            $table->index('status', 'idx_orders_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
