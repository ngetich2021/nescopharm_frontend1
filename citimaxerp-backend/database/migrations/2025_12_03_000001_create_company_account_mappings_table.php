<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This table stores the mapping between logical account purposes and actual
     * chart of account codes for each company. Each company can configure their
     * own account codes to match their chart of accounts structure.
     * 
     * Supports:
     * - Category-level mappings (e.g., expense accounts per expense category)
     * - Custom payment method mappings
     * - Fallback chains via parent_mapping_id
     * - Versioning/audit trail
     */
    public function up(): void
    {
        Schema::create('company_account_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id')->index();
            
            // Core mapping fields
            $table->string('mapping_key', 50)->index(); // e.g., 'cash_on_hand', 'accounts_receivable'
            $table->string('account_code', 20); // The actual account code in chart_of_accounts
            $table->uuid('chart_of_account_id')->nullable(); // Direct reference to the account
            
            // Context for granular mappings (e.g., expense category, payment method, store)
            $table->string('context_type', 50)->nullable()->index(); // 'expense_category', 'payment_method', 'store', 'product_category'
            $table->string('context_id', 50)->nullable()->index(); // The ID or key of the context (e.g., category_id, 'mpesa', store_id)
            
            // Fallback support - if this mapping isn't found, check the parent
            $table->uuid('parent_mapping_id')->nullable();
            
            // Metadata
            $table->string('description', 255)->nullable();
            $table->integer('priority')->default(0); // Higher priority = checked first for context matches
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false); // System mappings can't be deleted
            
            // Audit trail
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();

            // Foreign keys (except self-referential)
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->onDelete('set null');

            // Unique constraint: one mapping per key + context combination per company
            $table->unique(['company_id', 'mapping_key', 'context_type', 'context_id'], 'company_mapping_context_unique');
        });

        // Add self-referential foreign key after table is created
        Schema::table('company_account_mappings', function (Blueprint $table) {
            $table->foreign('parent_mapping_id')->references('id')->on('company_account_mappings')->onDelete('set null');
        });

        // Indexes for common query patterns
        Schema::table('company_account_mappings', function (Blueprint $table) {
            $table->index(['company_id', 'is_active']);
            $table->index(['company_id', 'mapping_key', 'is_active']);
            $table->index(['company_id', 'context_type', 'is_active']);
        });

        // Create payment method mappings table for custom payment methods per company
        Schema::create('company_payment_method_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id')->index();
            $table->string('payment_method', 50); // e.g., 'mpesa', 'bank_transfer', 'cash', custom methods
            $table->string('mapping_key', 50); // The account mapping key to use (e.g., 'mpesa_float', 'main_bank')
            $table->string('display_name', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'payment_method']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_payment_method_mappings');
        Schema::dropIfExists('company_account_mappings');
    }
};
