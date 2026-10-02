<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('type')->default('product')->after('name'); // 'product' | 'service'
            $table->uuid('income_account_id')->nullable()->after('tax_rate');
            $table->uuid('vat_category_id')->nullable()->after('income_account_id');
            $table->string('etims_item_class_code')->nullable()->after('hs_code');

            $table->foreign('income_account_id')->references('id')->on('chart_of_accounts')->onDelete('set null');
            $table->foreign('vat_category_id')->references('id')->on('tax_rates')->onDelete('set null');
            $table->index(['company_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['income_account_id']);
            $table->dropForeign(['vat_category_id']);
            $table->dropIndex(['company_id', 'type']);
            $table->dropColumn(['type', 'income_account_id', 'vat_category_id', 'etims_item_class_code']);
        });
    }
};
