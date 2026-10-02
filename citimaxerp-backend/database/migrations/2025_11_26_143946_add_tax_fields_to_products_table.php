<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds tax-related fields to products:
     * - is_taxable: Whether the product is subject to tax (default true)
     * - tax_rate: The tax percentage for this product (nullable, allows zero-rated products)
     * - hs_code: Harmonized System code for customs/trade classification (nullable)
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Is the product taxable? Default is true (most products are taxable)
            $table->boolean('is_taxable')->default(false)->after('is_digital');
            
            // Tax rate percentage (e.g., 16.00 for 16%, 0.00 for zero-rated)
            // Nullable - if null, use company/system default tax rate
            $table->decimal('tax_rate', 5, 2)->nullable()->after('is_taxable');
            
            // HS Code (Harmonized System) for international trade/customs
            // Typically 6-10 digits, but stored as string for flexibility
            $table->string('hs_code', 20)->nullable()->after('tax_rate');
            
            // Add index for tax-related queries
            $table->index('is_taxable', 'idx_products_is_taxable');
            $table->index('hs_code', 'idx_products_hs_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('idx_products_is_taxable');
            $table->dropIndex('idx_products_hs_code');
            $table->dropColumn(['is_taxable', 'tax_rate', 'hs_code']);
        });
    }
};
