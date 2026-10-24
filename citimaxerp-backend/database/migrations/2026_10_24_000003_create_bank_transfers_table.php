<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Money moved between the company's own money accounts - a bank withdrawal into cash to pay
    // wages or bills, a deposit, a bank-to-bank transfer - with the charge the bank took for it.
    public function up(): void
    {
        Schema::create('bank_transfers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('transfer_number', 30);
            $table->date('transfer_date');
            $table->uuid('from_account_id');
            $table->uuid('to_account_id');
            $table->decimal('amount', 15, 2);
            $table->decimal('charges', 15, 2)->default(0);
            $table->string('reference')->nullable();
            $table->string('purpose')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('from_account_id')->references('id')->on('chart_of_accounts');
            $table->foreign('to_account_id')->references('id')->on('chart_of_accounts');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->unique(['company_id', 'transfer_number']);
            $table->index(['company_id', 'transfer_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_transfers');
    }
};
