<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->decimal('default_unit_price', 18, 2)
                ->nullable()
                ->after('tax_type_code');
        });

        DB::statement(<<<'SQL'
            UPDATE etims_item_registrations AS registrations
            SET default_unit_price = ROUND(products.price::numeric, 2)
            FROM products
            WHERE products.id = registrations.product_id
              AND products.price > 0
              AND registrations.default_unit_price IS NULL
        SQL);
    }

    public function down(): void
    {
        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->dropColumn('default_unit_price');
        });
    }
};
