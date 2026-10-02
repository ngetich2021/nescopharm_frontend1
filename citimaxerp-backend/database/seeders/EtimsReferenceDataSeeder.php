<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the five KRA/DigiTax reference tables.
 *
 * IMPORTANT - partial seed:
 *   - tax_types: COMPLETE (5 rows, KRA fixed taxonomy)
 *   - payment_types: COMPLETE (6 rows, KRA fixed taxonomy)
 *   - packaging_units / quantity_units: SUBSET of the most common UN/ECE codes.
 *     DigiTax exposes ~50/~40 codes total. Full list must be imported from
 *     DigiTax docs (https://ke.docs.digitax.tech/) into etims_packaging_units.csv
 *     and etims_quantity_units.csv before going live. See TODO in this file.
 *   - item_class_codes: STARTER hierarchy only. The full KRA UNSPSC/CPC list has
 *     ~3000 leaf codes - this seeder ships the top-level CPC families so the
 *     picker is functional in dev. Production go-live requires the full import.
 *
 * Idempotent: uses insertOrIgnore so re-runs are safe.
 */
class EtimsReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // ─────────── Tax types (KRA fixed taxonomy) ───────────
        DB::table('etims_tax_types')->insertOrIgnore([
            ['code' => 'A', 'name' => 'Exempt', 'rate' => null, 'description' => 'Exempt from VAT', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'B', 'name' => 'VAT 16%', 'rate' => 0.1600, 'description' => 'Standard rate', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'C', 'name' => 'Zero-rated', 'rate' => 0.0000, 'description' => 'Zero-rated supplies', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'D', 'name' => 'Non-VAT', 'rate' => null, 'description' => 'Non-VATable items', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'E', 'name' => 'VAT 8%', 'rate' => 0.0800, 'description' => 'Reduced rate (e.g. fuel products)', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ─────────── Payment types ───────────
        DB::table('etims_payment_types')->insertOrIgnore([
            ['code' => '01', 'name' => 'Cash', 'created_at' => $now, 'updated_at' => $now],
            ['code' => '02', 'name' => 'Credit', 'created_at' => $now, 'updated_at' => $now],
            ['code' => '03', 'name' => 'Cash/Credit', 'created_at' => $now, 'updated_at' => $now],
            ['code' => '04', 'name' => 'Bank Cheque', 'created_at' => $now, 'updated_at' => $now],
            ['code' => '05', 'name' => 'Credit/Debit Card', 'created_at' => $now, 'updated_at' => $now],
            ['code' => '06', 'name' => 'Mobile Money', 'created_at' => $now, 'updated_at' => $now],
            ['code' => '07', 'name' => 'Other', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // ─────────── Packaging units (subset - extend from DigiTax docs) ───────────
        $packaging = [
            ['BG', 'Bag'], ['BX', 'Box'], ['BO', 'Bottle'], ['CN', 'Can'], ['CT', 'Carton'],
            ['CR', 'Crate'], ['DR', 'Drum'], ['DZ', 'Dozen'], ['EA', 'Each'], ['JR', 'Jar'],
            ['NE', 'Unpacked'], ['PK', 'Pack'], ['PT', 'Pot'], ['RO', 'Roll'], ['SH', 'Sheet'],
            ['TU', 'Tube'], ['VL', 'Vial'], ['BJ', 'Bucket'], ['BL', 'Bale'], ['BS', 'Basket'],
        ];
        DB::table('etims_packaging_units')->insertOrIgnore(
            array_map(fn($r) => ['code' => $r[0], 'name' => $r[1], 'created_at' => $now, 'updated_at' => $now], $packaging),
        );

        // ─────────── Quantity units (subset) ───────────
        $quantity = [
            ['PCS', 'Pieces'], ['KG', 'Kilogram'], ['G', 'Gram'], ['L', 'Litre'], ['ML', 'Millilitre'],
            ['M', 'Metre'], ['CM', 'Centimetre'], ['MM', 'Millimetre'], ['M2', 'Square Metre'], ['M3', 'Cubic Metre'],
            ['BOX', 'Box'], ['PKT', 'Packet'], ['CTN', 'Carton'], ['DZN', 'Dozen'], ['SET', 'Set'],
            ['PAIR', 'Pair'], ['HR', 'Hour'], ['DAY', 'Day'], ['MTH', 'Month'], ['YR', 'Year'],
            ['NO', 'Number'], ['SVC', 'Service'],
        ];
        DB::table('etims_quantity_units')->insertOrIgnore(
            array_map(fn($r) => ['code' => $r[0], 'name' => $r[1], 'created_at' => $now, 'updated_at' => $now], $quantity),
        );

        // ─────────── Item class codes (STARTER - top-level CPC families) ───────────
        // TODO: replace this hand-rolled set with a full DigiTax CPC CSV import
        // before production go-live (~3000 leaf codes). See `etims:import-item-classes`
        // command (Phase 8 reconcile/import command family).
        $classes = [
            // Level 1 - divisions
            ['0', 'Agriculture, forestry, fishery products', null, 1, false],
            ['1', 'Ores and minerals; electricity, gas and water', null, 1, false],
            ['2', 'Food products, beverages and tobacco; textiles, apparel and leather products', null, 1, false],
            ['3', 'Other transportable goods, except metal products, machinery and equipment', null, 1, false],
            ['4', 'Metal products, machinery and equipment', null, 1, false],
            ['5', 'Constructions and construction services', null, 1, false],
            ['6', 'Distributive trade services; accommodation; food and beverage services', null, 1, false],
            ['7', 'Financial and related services; real estate services', null, 1, false],
            ['8', 'Business and production services', null, 1, false],
            ['9', 'Community, social and personal services', null, 1, false],

            // A few representative leaves so the picker is usable in dev
            ['22120', 'Liquid milk, processed', '2', 5, true],
            ['23110', 'Bread', '2', 5, true],
            ['24110', 'Spirits, distilled alcoholic beverages', '2', 5, true],
            ['43210', 'Mobile phones', '4', 5, true],
            ['82310', 'Computer programming services', '8', 5, true],
            ['85120', 'Maintenance and repair services of office machinery', '8', 5, true],
            ['93210', 'Hairdressing services', '9', 5, true],
        ];
        DB::table('etims_item_class_codes')->insertOrIgnore(
            array_map(
                fn($r) => [
                    'code' => $r[0], 'name' => $r[1], 'parent_code' => $r[2],
                    'level' => $r[3], 'is_leaf' => DB::raw($r[4] ? 'TRUE' : 'FALSE'),
                    'created_at' => $now, 'updated_at' => $now,
                ],
                $classes,
            ),
        );
    }
}
