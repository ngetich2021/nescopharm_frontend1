<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tax_rates', function (Blueprint $table) {
            // KRA tax type code: A=exempt, B=VAT16, C=zero-rated, D=non-VAT, E=VAT8
            $table->string('etims_tax_type_code', 1)->nullable()->after('jurisdiction');
            $table->index('etims_tax_type_code');
        });

        // Best-effort backfill for Kenyan rates: map by rate value
        DB::statement(<<<'SQL'
            UPDATE tax_rates
            SET etims_tax_type_code = CASE
                WHEN ROUND(rate * 100, 2) = 16.00 THEN 'B'
                WHEN ROUND(rate * 100, 2) = 0.00  THEN 'C'
                WHEN ROUND(rate * 100, 2) = 8.00  THEN 'E'
                ELSE etims_tax_type_code
            END
            WHERE (jurisdiction ILIKE '%KE%' OR jurisdiction ILIKE '%Kenya%' OR jurisdiction IS NULL)
              AND etims_tax_type_code IS NULL
        SQL);
    }

    public function down(): void
    {
        Schema::table('tax_rates', function (Blueprint $table) {
            $table->dropIndex(['etims_tax_type_code']);
            $table->dropColumn('etims_tax_type_code');
        });
    }
};
