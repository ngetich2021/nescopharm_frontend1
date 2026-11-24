<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// An allowance paid outside payroll is charged, like an expense, to a ledger sub-account chosen as
// account -> sub-account, and paid from Petty Cash (cash) or Prime Bank (cheque / transfer). Its
// expenses (AllowanceExpenseService) take both. Replaces the unused expense_id link added earlier today.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_allowances', function (Blueprint $table) {
            if (!Schema::hasColumn('employee_allowances', 'account_id')) {
                $table->uuid('account_id')->nullable();
            }
            if (!Schema::hasColumn('employee_allowances', 'payment_method')) {
                $table->string('payment_method', 20)->nullable();
            }
        });
        if (Schema::hasColumn('employee_allowances', 'expense_id')) {
            Schema::table('employee_allowances', function (Blueprint $table) {
                $table->dropColumn('expense_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('employee_allowances', function (Blueprint $table) {
            foreach (['account_id', 'payment_method'] as $c) {
                if (Schema::hasColumn('employee_allowances', $c)) {
                    $table->dropColumn($c);
                }
            }
        });
    }
};
