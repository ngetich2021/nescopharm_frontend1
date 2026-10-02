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
        Schema::create('stock_counts', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->uuid('store_id');
            $table->string('count_number', 50);
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('count_type', 50)->default('cycle_count');
            $table->string('status', 50)->default('draft');
            $table->string('location', 255)->nullable();
            $table->string('category_filter', 255)->nullable();
            $table->timestamp('scheduled_date')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('created_by', 255);
            $table->string('assigned_to', 255)->nullable();
            $table->string('approved_by', 255)->nullable();
            $table->integer('total_products_expected')->default(0);
            $table->integer('total_products_counted')->default(0);
            $table->integer('total_variances')->default(0);
            $table->decimal('total_variance_value', 12, 2)->default(0);
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
        });

        // Add foreign keys, unique constraint and indexes after table creation
        Schema::table('stock_counts', function (Blueprint $table) {
            $table->unique(['company_id', 'store_id', 'count_number'], 'stock_counts_company_id_store_id_count_number_key');
            $table->foreign('company_id', 'stock_counts_company_id_fkey')->references('id')->on('companies');
            $table->foreign('store_id', 'stock_counts_store_id_fkey')->references('id')->on('stores');

            $table->index(['company_id', 'store_id'], 'idx_stock_counts_company_store');
            $table->index(['company_id', 'store_id', 'status'], 'idx_stock_counts_company_store_status');
            $table->index(['company_id', 'store_id', 'count_type'], 'idx_stock_counts_company_store_type');
            $table->index(['company_id', 'store_id', 'count_number'], 'idx_stock_counts_company_store_number');
        });

        // Add constraints
        DB::statement("
            ALTER TABLE stock_counts
            ADD CONSTRAINT valid_status
            CHECK (status IN ('draft', 'in_progress', 'completed', 'approved', 'cancelled'));
        ");

        DB::statement("
            ALTER TABLE stock_counts
            ADD CONSTRAINT valid_count_type
            CHECK (count_type IN ('cycle_count', 'full_count'));
        ");

        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER trigger_stock_counts_updated_at
            BEFORE UPDATE ON stock_counts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE stock_counts DROP CONSTRAINT IF EXISTS valid_status');
        DB::statement('ALTER TABLE stock_counts DROP CONSTRAINT IF EXISTS valid_count_type');
        DB::statement('DROP TRIGGER IF EXISTS trigger_stock_counts_updated_at ON stock_counts');
        Schema::dropIfExists('stock_counts');
    }
};
