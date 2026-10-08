<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_receipts', function (Blueprint $table) {
            $table->decimal('ppb_permit', 12, 2)->default(0)->after('logistics_cost');
            $table->decimal('idf', 12, 2)->default(0)->after('ppb_permit');
            $table->decimal('railway_levy', 12, 2)->default(0)->after('idf');
            $table->decimal('transport_cost', 12, 2)->default(0)->after('railway_levy');
            $table->decimal('clearing_agency_fee', 12, 2)->default(0)->after('transport_cost');
            $table->decimal('other_clearing_cost', 12, 2)->default(0)->after('clearing_agency_fee');
            $table->decimal('certificate_of_conformity', 12, 2)->default(0)->after('other_clearing_cost');
            $table->decimal('sgs_listing_approval', 12, 2)->default(0)->after('certificate_of_conformity');
            $table->decimal('vat_on_clearing', 12, 2)->default(0)->after('sgs_listing_approval');
            $table->decimal('vat_on_product', 12, 2)->default(0)->after('vat_on_clearing');
            $table->decimal('import_duty', 12, 2)->default(0)->after('vat_on_product');
            $table->decimal('excise_duty', 12, 2)->default(0)->after('import_duty');
            $table->decimal('fob_price', 12, 2)->default(0)->after('excise_duty');
        });
    }

    public function down(): void
    {
        Schema::table('product_receipts', function (Blueprint $table) {
            $table->dropColumn([
                'ppb_permit',
                'idf',
                'railway_levy',
                'transport_cost',
                'clearing_agency_fee',
                'other_clearing_cost',
                'certificate_of_conformity',
                'sgs_listing_approval',
                'vat_on_clearing',
                'vat_on_product',
                'import_duty',
                'excise_duty',
                'fob_price',
            ]);
        });
    }
};
