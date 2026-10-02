<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('employee_number', 50)->unique();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 255)->unique();
            $table->string('phone', 50)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('national_id', 50)->nullable();
            $table->string('kra_pin', 20)->nullable();
            $table->string('nssf_number', 50)->nullable();
            $table->string('shif_number', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->date('hire_date');
            $table->date('termination_date')->nullable();
            $table->enum('employment_type', ['full_time', 'part_time', 'contract', 'intern'])->default('full_time');
            $table->enum('payment_frequency', ['weekly', 'bi_weekly', 'monthly'])->default('monthly');
            $table->decimal('basic_salary', 15, 2)->default(0);
            $table->decimal('hourly_rate', 10, 2)->nullable();
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account', 50)->nullable();
            $table->string('bank_branch', 100)->nullable();

            $table->boolean('is_active')->default(true);
            $table->string('department', 100)->nullable();
            $table->string('position', 100)->nullable();
            $table->uuid('supervisor_id')->nullable();
            $table->jsonb('allowances')->nullable();
            $table->jsonb('deductions')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users');
            
            $table->index(['company_id', 'is_active']);
            $table->index(['company_id', 'employment_type']);
            $table->index(['hire_date']);
            $table->unique(['company_id', 'employee_number']);
        });

        // Add self-referencing foreign key after table creation
        Schema::table('employees', function (Blueprint $table) {
            $table->foreign('supervisor_id')->references('id')->on('employees');
        });

        DB::statement('
            CREATE TRIGGER update_employees_modtime
            BEFORE UPDATE ON employees
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
