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
        Schema::create('financial_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('name'); // e.g., "Q1 2025", "FY 2025"
            $table->enum('period_type', ['monthly', 'quarterly', 'semi_annual', 'annual']);
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['open', 'closed', 'locked'])->default('open');
            $table->boolean('is_current')->default(false);
            $table->text('description')->nullable();
            $table->uuid('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->uuid('locked_by')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('closed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('locked_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');

            $table->index(['company_id', 'status']);
            $table->index(['start_date', 'end_date']);
            $table->index('is_current');
            $table->unique(['company_id', 'start_date', 'end_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_periods');
    }
};
