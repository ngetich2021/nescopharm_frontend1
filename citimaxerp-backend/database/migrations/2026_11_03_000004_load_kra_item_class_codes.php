<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * KRA's item classification list (the 1,000 codes eTIMS accepts, from DigiTax's "Items: Item
 * Classification Table", March 2026) replaces the starter set, so the product form's class-code
 * field and the KRA tab offer only codes KRA takes. Some KRA names are long, so name becomes text.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE etims_item_class_codes ALTER COLUMN name TYPE text');

        $rows = json_decode(file_get_contents(database_path('data/etims_item_class_codes.json')), true);
        $now = now();
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('etims_item_class_codes')->upsert(
                array_map(fn ($r) => [
                    'code' => $r['code'],
                    'name' => $r['name'],
                    'parent_code' => $r['parent_code'],
                    'level' => $r['level'],
                    'is_leaf' => DB::raw($r['is_leaf'] ? 'TRUE' : 'FALSE'),
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk),
                ['code'],
                ['name', 'parent_code', 'level', 'is_leaf', 'updated_at'],
            );
        }

        // The starter rows (CPC families such as '2', '22120') are not KRA codes.
        DB::table('etims_item_class_codes')->whereNotIn('code', array_column($rows, 'code'))->delete();
    }

    public function down(): void
    {
        // The list stays: it is reference data, and products may already use its codes.
    }
};
