<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Payroll Module Enhancement (client document, 24/11/2026):
// - employees: statutory deductions apply (Y/N) and SHIF exempt, as in the KRA Compliance Tracker
// - payslips: NITA levy (employer, KES 50) and HELB kept apart from other deductions
// - payroll_runs: the salary payment itself - Paid from (ledger account), method, date, reference -
//   and a "payment initiated" step before Paid
// - statutory_payments: PAYE / NSSF / SHIF / Housing Levy / HELB / NITA paid to the authorities
// - company_accounting_settings.payroll_posting_start: payroll posts to the ledger only from this
//   month on (earlier salaries were booked as expenses)
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (!Schema::hasColumn('employees', 'statutory_deductions_apply')) {
                $table->boolean('statutory_deductions_apply')->default(true);
            }
            if (!Schema::hasColumn('employees', 'shif_exempt')) {
                $table->boolean('shif_exempt')->default(false);
            }
        });

        Schema::table('payroll_payslips', function (Blueprint $table) {
            if (!Schema::hasColumn('payroll_payslips', 'nita')) {
                $table->decimal('nita', 15, 2)->default(0);
            }
            if (!Schema::hasColumn('payroll_payslips', 'helb')) {
                $table->decimal('helb', 15, 2)->default(0);
            }
        });

        Schema::table('payroll_runs', function (Blueprint $table) {
            foreach ([
                'payment_account_id' => fn () => $table->uuid('payment_account_id')->nullable(),
                'payment_method' => fn () => $table->string('payment_method', 30)->nullable(),
                'payment_reference' => fn () => $table->string('payment_reference', 120)->nullable(),
                'payment_date' => fn () => $table->date('payment_date')->nullable(),
                'payment_initiated_by' => fn () => $table->uuid('payment_initiated_by')->nullable(),
                'payment_initiated_at' => fn () => $table->timestamp('payment_initiated_at')->nullable(),
            ] as $col => $add) {
                if (!Schema::hasColumn('payroll_runs', $col)) {
                    $add();
                }
            }
        });

        if (!Schema::hasTable('statutory_payments')) {
            Schema::create('statutory_payments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->index();
                $table->uuid('payroll_run_id')->index();
                $table->string('item', 30); // paye | nssf | shif | housing_levy | helb | nita
                $table->decimal('amount', 15, 2);
                $table->date('payment_date');
                $table->uuid('account_id')->nullable();
                $table->string('payment_method', 30)->nullable();
                $table->string('reference', 120);
                $table->string('attachment_path')->nullable();
                $table->text('notes')->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestamps();
                $table->foreign('payroll_run_id')->references('id')->on('payroll_runs')->onDelete('cascade');
                $table->unique(['company_id', 'item', 'reference'], 'statutory_payments_item_reference_unique');
            });
        }

        Schema::table('company_accounting_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('company_accounting_settings', 'payroll_posting_start')) {
                $table->date('payroll_posting_start')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('statutory_payments');
        foreach ([
            'employees' => ['statutory_deductions_apply', 'shif_exempt'],
            'payroll_payslips' => ['nita', 'helb'],
            'payroll_runs' => ['payment_account_id', 'payment_method', 'payment_reference', 'payment_date', 'payment_initiated_by', 'payment_initiated_at'],
            'company_accounting_settings' => ['payroll_posting_start'],
        ] as $t => $cols) {
            Schema::table($t, function (Blueprint $table) use ($t, $cols) {
                foreach ($cols as $c) {
                    if (Schema::hasColumn($t, $c)) {
                        $table->dropColumn($c);
                    }
                }
            });
        }
    }
};
