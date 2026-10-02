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
        // Create quotes table
        Schema::create('quotes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('quote_number', 20)->unique();
            $table->uuid('customer_id');
            $table->decimal('total_amount', 10, 2);
            $table->string('status', 20)->default('pending');
            $table->uuid('company_id')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('discount', 10, 2)->nullable();
            $table->decimal('final_amount', 10, 2)->nullable();
            $table->uuid('delivery_location_id')->nullable();
            $table->string('currency', 5)->nullable()->default('KES');
            $table->boolean('below_minimum_price')->default(false);
            $table->boolean('requires_approval')->default(false);
            $table->date('valid_until')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('deleted_at')->nullable();

            // Foreign keys
            $table->foreign('customer_id', 'quotes_customer_id_fkey')->references('id')->on('customers');
            $table->foreign('company_id', 'quotes_company_id_fkey')->references('id')->on('companies');
            $table->foreign('delivery_location_id', 'quotes_delivery_location_fkey')->references('id')->on('delivery_locations')->onDelete('set null');

            // Indexes
            $table->index('company_id', 'idx_quotes_company_id');
            $table->index('quote_number', 'idx_quotes_quote_number');
            $table->index('customer_id', 'idx_quotes_customer_id');
            $table->index('status', 'idx_quotes_status');
            $table->index('created_at', 'idx_quotes_created_at');
            $table->index('valid_until', 'idx_quotes_valid_until');
        });

        // Create quote_items table
        Schema::create('quote_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('quote_id');
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->uuid('company_id')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            // Foreign keys
            $table->foreign('quote_id', 'quote_items_quote_id_fkey')->references('id')->on('quotes')->onDelete('cascade');
            $table->foreign('product_id', 'quote_items_product_id_fkey')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id', 'quote_items_variant_id_fkey')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('company_id', 'quote_items_company_id_fkey')->references('id')->on('companies');
            // unit_id foreign key deferred to later migration (references product_packaging_units)

            // Indexes
            $table->index('quote_id', 'idx_quote_items_quote_id');
            $table->index('product_id', 'idx_quote_items_product_id');
            $table->index('variant_id', 'idx_quote_items_variant_id');
            $table->index('company_id', 'idx_quote_items_company_id');
            $table->index('unit_id', 'idx_quote_items_unit_id');
        });

        // Create quote_notes table
        Schema::create('quote_notes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('quote_id');
            $table->text('note_content');
            $table->uuid('created_by');
            $table->uuid('company_id');
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            // Foreign keys
            $table->foreign('quote_id', 'quote_notes_quote_id_fkey')->references('id')->on('quotes')->onDelete('cascade');
            $table->foreign('created_by', 'quote_notes_created_by_fkey')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('company_id', 'quote_notes_company_id_fkey')->references('id')->on('companies');

            // Indexes
            $table->index('quote_id', 'idx_quote_notes_quote_id');
            $table->index('created_by', 'idx_quote_notes_created_by');
            $table->index('company_id', 'idx_quote_notes_company_id');
            $table->index('created_at', 'idx_quote_notes_created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quote_notes');
        Schema::dropIfExists('quote_items');
        Schema::dropIfExists('quotes');
    }
};