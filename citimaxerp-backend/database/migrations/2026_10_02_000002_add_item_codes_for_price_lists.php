<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('item_number')->nullable()->after('product_number');
            $table->unique(['company_id', 'item_number']);
        });

        // Number existing products 1, 2, 3... per company, oldest first.
        $companies = DB::table('products')->select('company_id')->distinct()->pluck('company_id');
        foreach ($companies as $companyId) {
            $ids = DB::table('products')->where('company_id', $companyId)->orderBy('created_at')->orderBy('id')->pluck('id');
            foreach ($ids as $i => $id) {
                DB::table('products')->where('id', $id)->update(['item_number' => $i + 1]);
            }
        }

        Schema::table('product_price_tiers', function (Blueprint $table) {
            $table->string('item_code', 30)->nullable()->after('tier_name');
            $table->string('unit_of_measure', 50)->nullable()->after('price');
            $table->unique(['company_id', 'tier_name', 'item_code']);
        });

        foreach (['quote_items', 'order_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('price_unit', 50)->nullable()->after('price_label');
            });
        }
    }

    public function down(): void
    {
        foreach (['quote_items', 'order_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('price_unit');
            });
        }

        Schema::table('product_price_tiers', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'tier_name', 'item_code']);
            $table->dropColumn(['item_code', 'unit_of_measure']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'item_number']);
            $table->dropColumn('item_number');
        });
    }
};
