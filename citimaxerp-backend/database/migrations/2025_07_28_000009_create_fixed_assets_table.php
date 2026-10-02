<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixed_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('asset_number', 50);
            $table->string('asset_name', 255);
            $table->text('description')->nullable();
            $table->enum('asset_category', ['building', 'equipment', 'vehicle', 'furniture', 'computer', 'other']);
            $table->date('purchase_date');
            $table->decimal('purchase_cost', 15, 2);
            $table->decimal('residual_value', 15, 2)->default(0);
            $table->integer('useful_life_years');
            $table->enum('depreciation_method', ['straight_line', 'reducing_balance', 'units_of_production']);
            $table->decimal('depreciation_rate', 5, 2)->nullable();
            $table->decimal('accumulated_depreciation', 15, 2)->default(0);
            $table->decimal('book_value', 15, 2);
            $table->enum('status', ['active', 'disposed', 'written_off', 'transferred'])->default('active');
            $table->date('disposal_date')->nullable();
            $table->decimal('disposal_amount', 15, 2)->nullable();
            $table->text('disposal_reason')->nullable();
            $table->string('location', 255)->nullable();
            $table->string('serial_number', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->string('manufacturer', 100)->nullable();
            $table->date('warranty_expiry')->nullable();
            $table->uuid('assigned_to')->nullable();
            $table->uuid('created_by');
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('assigned_to')->references('id')->on('employees');
            $table->foreign('created_by')->references('id')->on('users');
            
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'asset_category']);
            $table->index(['purchase_date']);
            $table->unique(['company_id', 'asset_number']);
        });

        DB::statement('
            CREATE TRIGGER update_fixed_assets_modtime
            BEFORE UPDATE ON fixed_assets
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('fixed_assets');
    }
};
