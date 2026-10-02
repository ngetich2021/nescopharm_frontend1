<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->uuid('sales_rep_id')->nullable()->after('customer_id');
            $table->foreign('sales_rep_id')->references('id')->on('users')->nullOnDelete();
            $table->index('sales_rep_id');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['sales_rep_id']);
            $table->dropColumn('sales_rep_id');
        });
    }
};
