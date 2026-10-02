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
        Schema::create('tax_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('name');
            $table->string('code')->unique();
            $table->string('description')->nullable();
            $table->decimal('rate', 5, 4); // e.g., 0.1600 for 16%
            $table->enum('type', ['vat', 'sales_tax', 'service_tax', 'withholding_tax', 'excise_tax', 'other']);
            $table->enum('calculation_method', ['percentage', 'fixed_amount', 'tiered']);
            $table->json('calculation_rules')->nullable(); // For complex calculations
            $table->uuid('chart_of_account_id')->nullable(); // Tax payable account
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('jurisdiction')->nullable(); // Country/State/Province
            $table->json('applicable_to')->nullable(); // Products, services, etc.
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');

            $table->index(['company_id', 'is_active']);
            $table->index(['type', 'is_active']);
            $table->index('effective_from');
            $table->index('code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tax_rates');
    }
};
