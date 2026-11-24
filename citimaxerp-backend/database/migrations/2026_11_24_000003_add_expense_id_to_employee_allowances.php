<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// A one-time allowance is paid as an expense (ledger account -> sub-account, Petty Cash or Prime Bank)
// so it is in the books; the allowance keeps a link to that expense.
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('employee_allowances', 'expense_id')) {
            Schema::table('employee_allowances', function (Blueprint $table) {
                $table->uuid('expense_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('employee_allowances', 'expense_id')) {
            Schema::table('employee_allowances', function (Blueprint $table) {
                $table->dropColumn('expense_id');
            });
        }
    }
};
