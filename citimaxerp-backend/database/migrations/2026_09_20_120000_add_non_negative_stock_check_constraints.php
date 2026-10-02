<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Defense-in-depth: no matter which code path touches stock (a sale, dispatch,
 * repair, breakage, adjustment, or a bug in a future one we haven't written
 * yet), the database itself refuses to let stock go negative. Application-level
 * checks (ChecksStockAvailability trait) are the primary guard and give a
 * proper error message; this is the last line of defense.
 *
 * Existing negative rows must be corrected before this runs, or Postgres will
 * refuse to add the constraint - confirmed clean as of this migration (2
 * variant rows with negative stock_quantity were corrected to 0 beforehand).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_stock_quantity_non_negative CHECK (stock_quantity >= 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_on_hand_non_negative CHECK (on_hand >= 0)');
        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_quantity_non_negative CHECK (stock_quantity >= 0)');
        DB::statement('ALTER TABLE product_variants ADD CONSTRAINT product_variants_on_hand_non_negative CHECK (on_hand >= 0)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_quantity_non_negative');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_on_hand_non_negative');
        DB::statement('ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_stock_quantity_non_negative');
        DB::statement('ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_on_hand_non_negative');
    }
};
