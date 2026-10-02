<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE etims_item_registrations AS registrations
            SET tax_type_code = CASE
                WHEN products.is_taxable = false THEN 'D'
                WHEN products.tax_rate = 0 THEN 'C'
                WHEN products.tax_rate = 8 THEN 'E'
                ELSE 'B'
            END
            FROM products
            WHERE products.id = registrations.product_id
              AND registrations.tax_type_code IS NULL
        SQL);

        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->dropUnique('etims_items_one_per_product');
            $table->unique(
                ['company_id', 'product_id', 'tax_type_code'],
                'etims_items_one_per_product_tax',
            );
        });
    }

    public function down(): void
    {
        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->dropUnique('etims_items_one_per_product_tax');
        });

        DB::statement(<<<'SQL'
            DELETE FROM etims_item_registrations
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY company_id, product_id
                        ORDER BY created_at, id
                    ) AS position
                    FROM etims_item_registrations
                ) AS ranked
                WHERE position > 1
            )
        SQL);

        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->unique(['company_id', 'product_id'], 'etims_items_one_per_product');
        });
    }
};
