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
        Schema::create('budget_line_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('budget_id');
            $table->uuid('chart_of_account_id');
            $table->string('description')->nullable();
            $table->decimal('budgeted_amount', 15, 2);
            $table->decimal('actual_amount', 15, 2)->default(0);
            $table->decimal('committed_amount', 15, 2)->default(0); // Purchase orders, etc.
            $table->decimal('variance', 15, 2)->default(0);
            $table->decimal('variance_percentage', 5, 2)->default(0);
            $table->json('monthly_breakdown')->nullable(); // For detailed monthly budgets
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('budget_id')->references('id')->on('budgets')->onDelete('cascade');
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->onDelete('cascade');

            $table->index(['budget_id', 'chart_of_account_id']);
            $table->unique(['budget_id', 'chart_of_account_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_line_items');
    }
};
