<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Companies that record salaries as monthly expenses switch this off, so approved payroll
    // runs (kept for payslips) don't post salaries to the books a second time.
    public function up(): void
    {
        Schema::table('company_accounting_settings', function (Blueprint $table) {
            $table->boolean('payroll_posts_to_ledger')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('company_accounting_settings', function (Blueprint $table) {
            $table->dropColumn('payroll_posts_to_ledger');
        });
    }
};
