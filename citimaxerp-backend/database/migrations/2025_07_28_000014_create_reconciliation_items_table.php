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
        Schema::create('reconciliation_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reconciliation_id');
            $table->uuid('bank_transaction_id')->nullable();
            $table->uuid('journal_entry_id')->nullable();
            $table->enum('item_type', ['bank_transaction', 'book_entry', 'adjustment']);
            $table->string('description');
            $table->decimal('amount', 15, 2);
            $table->date('transaction_date');
            $table->enum('status', ['matched', 'unmatched', 'outstanding', 'disputed'])->default('unmatched');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('reconciliation_id')->references('id')->on('bank_reconciliations')->onDelete('cascade');
            $table->foreign('bank_transaction_id')->references('id')->on('bank_transactions')->onDelete('set null');
            $table->foreign('journal_entry_id')->references('id')->on('journal_entries')->onDelete('set null');

            $table->index(['reconciliation_id', 'status']);
            $table->index('item_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reconciliation_items');
    }
};
