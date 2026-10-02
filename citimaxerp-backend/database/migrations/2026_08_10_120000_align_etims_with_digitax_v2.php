<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_etims_configs', function (Blueprint $table) {
            $table->string('name')->default('DigiTax Kenya')->after('company_id');
            $table->string('country_code', 2)->default('KE')->after('name');
            $table->index(['company_id', 'country_code', 'superseded_at'], 'company_etims_country_idx');
        });

        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->string('digitax_item_id')->nullable()->after('product_id');
            $table->unique(['company_id', 'digitax_item_id'], 'etims_items_digitax_id_unique');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->boolean('etims_requested')->default(true)->after('metadata');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('etims_requested');
        });

        Schema::table('etims_item_registrations', function (Blueprint $table) {
            $table->dropUnique('etims_items_digitax_id_unique');
            $table->dropColumn('digitax_item_id');
        });

        Schema::table('company_etims_configs', function (Blueprint $table) {
            $table->dropIndex('company_etims_country_idx');
            $table->dropColumn(['name', 'country_code']);
        });
    }
};
