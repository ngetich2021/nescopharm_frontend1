<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->unsignedInteger('pending_credit_days')->nullable()->after('credit_days');
        });

        Schema::table('customer_account_approvals', function (Blueprint $table) {
            $table->unsignedInteger('previous_credit_days')->nullable()->after('new_credit_limit');
            $table->unsignedInteger('new_credit_days')->nullable()->after('previous_credit_days');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->uuid('sales_rep_id')->nullable()->after('customer_id');
            $table->foreign('sales_rep_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['sales_rep_id']);
            $table->dropColumn('sales_rep_id');
        });

        Schema::table('customer_account_approvals', function (Blueprint $table) {
            $table->dropColumn(['previous_credit_days', 'new_credit_days']);
        });

        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->dropColumn('pending_credit_days');
        });
    }
};
