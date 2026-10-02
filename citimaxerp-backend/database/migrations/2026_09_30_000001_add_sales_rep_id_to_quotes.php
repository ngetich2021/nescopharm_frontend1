<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->uuid('sales_rep_id')->nullable()->after('original_submitted_by_id');

            $table->foreign('sales_rep_id', 'quotes_sales_rep_id_fkey')
                ->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign('quotes_sales_rep_id_fkey');
            $table->dropColumn('sales_rep_id');
        });
    }
};
