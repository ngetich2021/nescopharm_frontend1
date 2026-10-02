<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('payroll_number', 50);
            $table->date('pay_period_start');
            $table->date('pay_period_end');
            $table->date('pay_date');
            $table->enum('status', ['draft', 'processed', 'approved', 'paid', 'cancelled'])->default('draft');
            $table->decimal('total_gross_pay', 15, 2)->default(0);
            $table->decimal('total_deductions', 15, 2)->default(0);
            $table->decimal('total_net_pay', 15, 2)->default(0);
            $table->decimal('total_paye', 15, 2)->default(0);
            $table->decimal('total_nssf', 15, 2)->default(0);
            $table->decimal('total_shif', 15, 2)->default(0);
            $table->integer('employee_count')->default(0);
            $table->uuid('created_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->uuid('processed_by')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->text('notes')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users');
            $table->foreign('approved_by')->references('id')->on('users');
            $table->foreign('processed_by')->references('id')->on('users');
            
            $table->index(['company_id', 'status']);
            $table->index(['pay_period_start', 'pay_period_end']);
            $table->index(['pay_date']);
            $table->unique(['company_id', 'payroll_number']);
        });

        DB::statement('
            CREATE TRIGGER update_payroll_records_modtime
            BEFORE UPDATE ON payroll_records
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_records');
    }
};
