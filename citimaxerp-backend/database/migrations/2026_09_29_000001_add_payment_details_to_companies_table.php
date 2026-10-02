<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('bank_name')->nullable()->after('letterhead_url');
            $table->string('bank_account_name')->nullable()->after('bank_name');
            $table->string('bank_account_number')->nullable()->after('bank_account_name');
            $table->string('bank_branch')->nullable()->after('bank_account_number');
            $table->string('mpesa_paybill')->nullable()->after('bank_branch');
            $table->string('mpesa_account_number')->nullable()->after('mpesa_paybill');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'bank_name',
                'bank_account_name',
                'bank_account_number',
                'bank_branch',
                'mpesa_paybill',
                'mpesa_account_number',
            ]);
        });
    }
};
