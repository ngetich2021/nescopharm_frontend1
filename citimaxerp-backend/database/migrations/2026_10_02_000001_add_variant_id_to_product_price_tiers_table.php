<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_price_tiers', function (Blueprint $table) {
            $table->uuid('variant_id')->nullable()->after('product_id');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->index(['variant_id']);
        });
    }

    public function down(): void
    {
        Schema::table('product_price_tiers', function (Blueprint $table) {
            $table->dropForeign(['variant_id']);
            $table->dropIndex(['variant_id']);
            $table->dropColumn('variant_id');
        });
    }
};
