<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bank Reconciliation (Tally BRS): each Bank Book entry gets the date it went through the bank
 * (bank_clearings.bank_date). A saved reconciliation (bank_reconciliation_statements) records the
 * statement balance as at a date and how it agreed with the books, and locks the entries it covered.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_clearings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('account_id');
            $table->uuid('journal_entry_id');
            $table->date('bank_date');
            $table->uuid('cleared_by')->nullable();
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('chart_of_accounts')->cascadeOnDelete();
            $table->foreign('journal_entry_id')->references('id')->on('journal_entries')->cascadeOnDelete();
            $table->unique(['account_id', 'journal_entry_id']);
            $table->index(['company_id', 'account_id', 'bank_date']);
        });

        Schema::create('bank_reconciliation_statements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('account_id');
            $table->date('statement_date');
            $table->decimal('statement_balance', 15, 2);
            $table->decimal('book_balance', 15, 2);
            $table->decimal('deposits_not_credited', 15, 2)->default(0);
            $table->decimal('payments_not_debited', 15, 2)->default(0);
            $table->decimal('in_bank_not_in_books', 15, 2)->default(0);
            $table->decimal('bank_balance_from_books', 15, 2);
            $table->decimal('difference', 15, 2)->default(0);
            $table->unsignedInteger('entries_cleared')->default(0);
            $table->text('notes')->nullable();
            $table->uuid('reconciled_by')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('chart_of_accounts')->cascadeOnDelete();
            $table->index(['company_id', 'account_id', 'statement_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_reconciliation_statements');
        Schema::dropIfExists('bank_clearings');
    }
};
