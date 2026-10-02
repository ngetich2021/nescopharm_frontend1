<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id')->index();
            $table->uuid('store_id')->nullable()->index();
            
            // Reference number for the adjustment
            $table->string('adjustment_number', 50)->unique();
            
            // Product information
            $table->uuid('product_id')->index();
            $table->uuid('variant_id')->nullable()->index();
            $table->uuid('batch_id')->nullable()->index(); // Optional reference to specific batch
            $table->uuid('unit_id')->nullable()->index(); // Optional reference to packaging unit
            
            // Adjustment details
            $table->enum('adjustment_type', ['increase', 'decrease', 'set'])->default('increase');
            $table->enum('reason_type', [
                'damage',
                'expiry',
                'theft',
                'loss',
                'found',
                'recount',
                'correction',
                'return',
                'donation',
                'sample',
                'write_off',
                'other'
            ])->default('correction');
            
            // Quantities
            $table->integer('quantity_before')->default(0);
            $table->integer('quantity_adjusted'); // The amount being adjusted (positive or negative)
            $table->integer('quantity_after')->default(0);
            
            // Financial tracking
            $table->decimal('unit_cost', 15, 2)->nullable();
            $table->decimal('total_cost', 15, 2)->nullable(); // Total cost impact
            $table->decimal('unit_price', 15, 2)->nullable();
            $table->decimal('total_value', 15, 2)->nullable(); // Total value impact
            
            // Status and approval
            $table->enum('status', ['draft', 'pending', 'approved', 'rejected', 'completed'])->default('draft');
            $table->uuid('created_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            
            // Documentation
            $table->string('reason', 500); // Required reason for adjustment
            $table->text('notes')->nullable();
            $table->text('rejection_reason')->nullable();
            
            // Supporting documents
            $table->jsonb('attachments')->nullable(); // Array of file URLs
            $table->jsonb('metadata')->nullable(); // Additional data
            
            // Reference to related inventory movement
            $table->uuid('inventory_movement_id')->nullable();
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('store_id')->references('id')->on('stores')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('cascade');
            $table->foreign('batch_id')->references('id')->on('inventory_batches')->onDelete('set null');
            $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('rejected_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('inventory_movement_id')->references('id')->on('inventory_movements')->onDelete('set null');
            
            // Indexes
            $table->index(['company_id', 'store_id'], 'idx_stock_adjustments_company_store');
            $table->index(['product_id', 'variant_id'], 'idx_stock_adjustments_product_variant');
            $table->index('status', 'idx_stock_adjustments_status');
            $table->index('reason_type', 'idx_stock_adjustments_reason_type');
            $table->index('adjustment_type', 'idx_stock_adjustments_adjustment_type');
            $table->index('created_at', 'idx_stock_adjustments_created_at');
        });
        
        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER update_stock_adjustments_modtime
            BEFORE UPDATE ON stock_adjustments
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_stock_adjustments_modtime ON stock_adjustments');
        Schema::dropIfExists('stock_adjustments');
    }
};
