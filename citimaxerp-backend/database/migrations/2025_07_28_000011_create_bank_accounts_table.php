<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('chart_of_account_id')->nullable();
            $table->string('account_name');
            $table->string('account_number');
            $table->string('bank_name');
            $table->string('bank_code')->nullable();
            $table->string('branch_name')->nullable();
            $table->string('branch_code')->nullable();
            $table->string('swift_code')->nullable();
            $table->string('iban')->nullable();
            $table->enum('account_type', ['checking', 'savings', 'money_market', 'certificate_of_deposit', 'other']);
            $table->string('currency_code', 3)->default('KES');
            $table->decimal('current_balance', 15, 2)->default(0);
            $table->decimal('available_balance', 15, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('allow_overdraft')->default(false);
            $table->decimal('overdraft_limit', 15, 2)->default(0);
            $table->text('description')->nullable();
            $table->json('bank_details')->nullable(); // Additional bank-specific details
            $table->timestamp('last_reconciled_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');

            $table->index(['company_id', 'is_active']);
            $table->index('account_number');
            $table->index('bank_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
    }
};
