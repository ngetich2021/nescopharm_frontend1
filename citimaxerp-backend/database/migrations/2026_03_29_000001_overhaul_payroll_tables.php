<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Employee Allowances / Deductions (configured per employee) ───
        Schema::create('employee_allowances', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->string('name');                        // e.g. "House Allowance", "Car Loan"
            $table->string('type');                         // allowance | deduction
            $table->decimal('amount', 12, 2);
            $table->string('frequency')->default('monthly'); // monthly | quarterly | annual | one_time
            $table->boolean('is_taxable')->default(true);
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->index(['employee_id', 'is_active']);
        });

        // ─── Payroll Runs (replaces payroll_records concept) ───
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->integer('pay_month');      // 1-12
            $table->integer('pay_year');
            $table->string('status')->default('draft'); // draft | approved | paid
            $table->text('notes')->nullable();
            $table->uuid('created_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->uuid('paid_by')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['company_id', 'pay_month', 'pay_year']);
        });

        // ─── Payroll Payslips (individual employee calculations per run) ───
        Schema::create('payroll_payslips', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('payroll_run_id');
            $table->uuid('employee_id');
            $table->uuid('company_id');

            // Gross
            $table->decimal('gross_pay', 12, 2);
            $table->decimal('insurance_relief_premium', 12, 2)->default(0);

            // Custom allowances & deductions (JSON snapshot)
            $table->jsonb('allowances_json')->nullable();    // [{name, amount, frequency, is_taxable}]
            $table->decimal('total_allowances', 12, 2)->default(0);
            $table->jsonb('deductions_json')->nullable();    // [{name, amount, frequency}]
            $table->decimal('total_custom_deductions', 12, 2)->default(0);

            // NSSF
            $table->decimal('nssf_tier1', 12, 2)->default(0);
            $table->decimal('nssf_tier2', 12, 2)->default(0);
            $table->decimal('nssf_employee', 12, 2)->default(0);
            $table->decimal('nssf_employer', 12, 2)->default(0);

            // PAYE
            $table->decimal('taxable_pay', 12, 2)->default(0);
            $table->decimal('paye_before_relief', 12, 2)->default(0);
            $table->decimal('personal_relief', 12, 2)->default(0);
            $table->decimal('insurance_relief', 12, 2)->default(0);
            $table->decimal('paye', 12, 2)->default(0);

            // SHIF & Housing
            $table->decimal('shif', 12, 2)->default(0);
            $table->decimal('housing_levy_employee', 12, 2)->default(0);
            $table->decimal('housing_levy_employer', 12, 2)->default(0);

            // Other deductions
            $table->decimal('salary_advance_deduction', 12, 2)->default(0);
            $table->decimal('other_deductions', 12, 2)->default(0);
            $table->string('other_deductions_note')->nullable();

            // Totals
            $table->decimal('total_deductions', 12, 2)->default(0);
            $table->decimal('net_pay', 12, 2)->default(0);

            $table->timestamps();

            $table->foreign('payroll_run_id')->references('id')->on('payroll_runs')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['payroll_run_id', 'employee_id']);
            $table->index('employee_id');
        });

        // ─── Update salary_advances to link to payroll runs ───
        Schema::table('salary_advances', function (Blueprint $table) {
            if (!Schema::hasColumn('salary_advances', 'deducted_in_run')) {
                $table->uuid('deducted_in_run')->nullable()->after('status');
            }
            if (!Schema::hasColumn('salary_advances', 'reviewer_notes')) {
                $table->text('reviewer_notes')->nullable()->after('approved_at');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_payslips');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('employee_allowances');

        Schema::table('salary_advances', function (Blueprint $table) {
            $table->dropColumn(['deducted_in_run', 'reviewer_notes']);
        });
    }
};
