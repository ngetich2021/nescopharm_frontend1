<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Edit Account showed a Currency box that saved nowhere; accounts now keep their currency.
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('chart_of_accounts', 'currency_code')) {
            Schema::table('chart_of_accounts', function (Blueprint $table) {
                $table->string('currency_code', 3)->default('KES');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('chart_of_accounts', 'currency_code')) {
            Schema::table('chart_of_accounts', function (Blueprint $table) {
                $table->dropColumn('currency_code');
            });
        }
    }
};
