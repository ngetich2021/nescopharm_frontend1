<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('payroll_record_id');
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->decimal('basic_salary', 15, 2)->default(0);
            $table->decimal('allowances', 15, 2)->default(0);
            $table->decimal('overtime_amount', 15, 2)->default(0);
            $table->decimal('bonus_amount', 15, 2)->default(0);
            $table->decimal('gross_pay', 15, 2)->default(0);
            $table->decimal('paye_amount', 15, 2)->default(0);
            $table->decimal('nssf_amount', 15, 2)->default(0);
            $table->decimal('shif_amount', 15, 2)->default(0);
            $table->decimal('other_deductions', 15, 2)->default(0);
            $table->decimal('total_deductions', 15, 2)->default(0);
            $table->decimal('net_pay', 15, 2)->default(0);
            $table->decimal('hours_worked', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->decimal('days_worked', 5, 2)->default(0);
            $table->decimal('leave_days', 5, 2)->default(0);
            $table->jsonb('allowance_breakdown')->nullable();
            $table->jsonb('deduction_breakdown')->nullable();
            $table->text('notes')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('payroll_record_id')->references('id')->on('payroll_records')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            
            $table->index(['payroll_record_id']);
            $table->index(['employee_id']);
            $table->index(['company_id']);
            $table->unique(['payroll_record_id', 'employee_id']);
        });

        DB::statement('
            CREATE TRIGGER update_payroll_items_modtime
            BEFORE UPDATE ON payroll_items
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_items');
    }
};
