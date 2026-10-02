<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->unsignedInteger('credit_days')->nullable()->after('credit_period_required');
        });
    }

    public function down(): void
    {
        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->dropColumn('credit_days');
        });
    }
};
