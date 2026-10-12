<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// One price-list code can cover several sizes that are stocked as separate products
// (e.g. NSPO 005 "ET Tubes Cuffed ID 2.0-8"), so a code is unique per product, not per list.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_price_tiers', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'tier_name', 'item_code']);
            $table->unique(['company_id', 'tier_name', 'item_code', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::table('product_price_tiers', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'tier_name', 'item_code', 'product_id']);
            $table->unique(['company_id', 'tier_name', 'item_code']);
        });
    }
};
