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
        Schema::create('invoice_line_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('invoice_id');
            $table->uuid('product_id')->nullable();
            $table->uuid('variant_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->string('description');
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable();
            $table->string('unit')->default('pcs');
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        // Add foreign keys and indexes after table creation
        Schema::table('invoice_line_items', function (Blueprint $table) {
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('set null');
            $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
            
            $table->index(['invoice_id']);
            $table->index(['product_id']);
            $table->index('unit_id', 'idx_invoice_line_items_unit_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_line_items');
    }
};
