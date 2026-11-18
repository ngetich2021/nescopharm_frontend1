<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A physical count of the petty cash box, against what the books say should be there on that
    // date. Counted minus system is the surplus (+) or shortage (-).
    public function up(): void
    {
        if (Schema::hasTable('petty_cash_counts')) {
            return;
        }
        Schema::create('petty_cash_counts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('account_id');
            $table->date('count_date');
            $table->decimal('counted_amount', 15, 2);
            $table->decimal('system_balance', 15, 2);
            $table->decimal('difference', 15, 2);
            $table->json('denominations')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('counted_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('account_id')->references('id')->on('chart_of_accounts');
            $table->foreign('counted_by')->references('id')->on('users')->onDelete('set null');
            $table->index(['company_id', 'count_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('petty_cash_counts');
    }
};
