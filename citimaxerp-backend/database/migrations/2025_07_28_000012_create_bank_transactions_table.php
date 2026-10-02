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
        Schema::create('bank_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('bank_account_id');
            $table->string('transaction_reference')->unique();
            $table->string('bank_reference')->nullable();
            $table->enum('transaction_type', ['debit', 'credit']);
            $table->decimal('amount', 15, 2);
            $table->decimal('running_balance', 15, 2)->nullable();
            $table->string('description');
            $table->string('payee_payer')->nullable();
            $table->string('category')->nullable();
            $table->date('transaction_date');
            $table->date('value_date')->nullable();
            $table->enum('status', ['pending', 'cleared', 'cancelled', 'failed'])->default('pending');
            $table->uuid('journal_entry_id')->nullable();
            $table->uuid('reconciliation_id')->nullable();
            $table->boolean('is_reconciled')->default(false);
            $table->json('metadata')->nullable(); // Bank-specific additional data
            $table->uuid('imported_by')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('bank_account_id')->references('id')->on('bank_accounts')->onDelete('cascade');
            $table->foreign('journal_entry_id')->references('id')->on('journal_entries')->onDelete('set null');
            $table->foreign('imported_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');

            $table->index(['company_id', 'bank_account_id']);
            $table->index(['transaction_date', 'bank_account_id']);
            $table->index(['status', 'is_reconciled']);
            $table->index('transaction_reference');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bank_transactions');
    }
};
