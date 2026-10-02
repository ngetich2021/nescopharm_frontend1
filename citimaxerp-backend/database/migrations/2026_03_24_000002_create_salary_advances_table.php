<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_advances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('employee_id');
            $table->decimal('amount', 15, 2);
            $table->date('request_date');
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'paid', 'rejected', 'cancelled'])->default('pending');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->uuid('created_by');
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users');

            $table->index(['company_id', 'status']);
            $table->index(['employee_id']);
        });

        DB::statement('
            CREATE TRIGGER update_salary_advances_modtime
            BEFORE UPDATE ON salary_advances
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advances');
    }
};
