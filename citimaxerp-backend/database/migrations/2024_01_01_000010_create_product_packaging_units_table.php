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
        Schema::create('product_packaging_units', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('product_id');
            $table->uuid('parent_unit_id')->nullable();
            
            // Unit information
            $table->string('unit_name', 100); // e.g., "Carton", "Box", "Piece"
            $table->string('unit_abbreviation', 20); // e.g., "CTN", "BOX", "PC"
            $table->text('description')->nullable();
            
            // Conversion - how many base units in this unit
            $table->decimal('base_unit_quantity', 15, 4); // e.g., 1 Carton = 100 pieces
            $table->decimal('units_per_parent', 15, 4)->nullable();
            
            // Flags
            $table->boolean('is_base_unit')->default(false); // The smallest unit (e.g., Piece)
            $table->boolean('is_sellable')->default(true); // Can customers order in this unit?
            $table->boolean('is_purchasable')->default(true); // Can we buy in this unit?
            $table->boolean('is_active')->default(true);
            
            // Optional pricing per unit (can override calculated price)
            $table->decimal('price_per_unit', 15, 2)->nullable();
            $table->decimal('cost_per_unit', 15, 2)->nullable();
            
            // Display and ordering
            $table->integer('display_order')->default(0); // For sorting (Carton=1, Box=2, Piece=3)
            
            // Barcode for this specific unit (optional)
            $table->string('barcode')->nullable();
            
            // Physical dimensions for this packaging unit
            $table->decimal('weight', 10, 2)->nullable();
            $table->decimal('length', 10, 2)->nullable();
            $table->decimal('width', 10, 2)->nullable();
            $table->decimal('height', 10, 2)->nullable();
            
            $table->timestamps();
        });
        
        // Add indexes separately
        Schema::table('product_packaging_units', function (Blueprint $table) {
            $table->index('company_id');
            $table->index('product_id');
            $table->index(['product_id', 'is_active']);
            $table->index(['company_id', 'product_id']);
            $table->index('display_order');
            $table->index('is_base_unit');
            $table->index('parent_unit_id', 'idx_product_packaging_units_parent');
        });
        
        // Add foreign keys separately
        Schema::table('product_packaging_units', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('parent_unit_id')->references('id')->on('product_packaging_units')->onDelete('restrict');
        });
        
        // Create partial unique index for base units (PostgreSQL syntax)
        DB::statement('
            CREATE UNIQUE INDEX IF NOT EXISTS unique_product_base_unit 
            ON product_packaging_units (product_id) 
            WHERE is_base_unit = true
        ');
        
        // Add trigger for updated_at
        DB::statement('
            CREATE TRIGGER update_product_packaging_units_modtime
            BEFORE UPDATE ON product_packaging_units
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_product_packaging_units_modtime ON product_packaging_units');
        DB::statement('DROP INDEX IF EXISTS unique_product_base_unit');
        Schema::dropIfExists('product_packaging_units');
    }
};
