<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Lets a requisition line reference a free-text item name (e.g. "broom")
     * instead of a catalog product, for things nobody has bothered to add
     * as a Product yet. Exactly one of product_id/custom_item_name must be set.
     */
    public function up(): void
    {
        Schema::table('requisition_items', function ($table) {
            $table->string('custom_item_name')->nullable()->after('product_id');
        });

        DB::statement('ALTER TABLE requisition_items ALTER COLUMN product_id DROP NOT NULL');
        DB::statement(
            'ALTER TABLE requisition_items ADD CONSTRAINT requisition_items_product_or_custom_name_check '
            . 'CHECK (product_id IS NOT NULL OR custom_item_name IS NOT NULL)'
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE requisition_items DROP CONSTRAINT IF EXISTS requisition_items_product_or_custom_name_check');

        // Any existing custom (product_id-less) items would violate the restored
        // NOT NULL constraint - drop them before reinstating it.
        DB::table('requisition_items')->whereNull('product_id')->delete();
        DB::statement('ALTER TABLE requisition_items ALTER COLUMN product_id SET NOT NULL');

        Schema::table('requisition_items', function ($table) {
            $table->dropColumn('custom_item_name');
        });
    }
};
