<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('product_price_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('product_id')->nullable();
            $table->uuid('variant_id')->nullable();
            $table->uuid('packaging_unit_id')->nullable();
            $table->uuid('receipt_item_id')->nullable();
            
            // Type of price being tracked
            $table->string('price_type', 50)->index();
            
            // Price change details
            $table->decimal('old_value', 10, 2)->nullable();
            $table->decimal('new_value', 10, 2);
            $table->decimal('change_amount', 10, 2)->nullable();
            $table->decimal('change_percentage', 8, 2)->nullable();
            
            // Change tracking
            $table->uuid('changed_by')->nullable();
            $table->text('change_reason')->nullable();
            $table->string('source', 50)->default('manual_update')->index();
            $table->string('source_reference')->nullable();
            
            // Additional metadata (JSON)
            $table->jsonb('metadata')->nullable();
            
            // Timestamps
            $table->timestamp('created_at')->nullable();
            
            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('packaging_unit_id')->references('id')->on('product_packaging_units')->onDelete('cascade');
            $table->foreign('receipt_item_id')->references('id')->on('product_receipt_items')->onDelete('set null');
            $table->foreign('changed_by')->references('id')->on('users')->onDelete('set null');
            
            // Indexes for common queries
            $table->index(['product_id', 'price_type', 'created_at']);
            $table->index(['variant_id', 'price_type', 'created_at']);
            $table->index(['packaging_unit_id', 'price_type', 'created_at']);
            $table->index(['company_id', 'created_at']);
            $table->index(['changed_by', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_price_histories');
    }
};
