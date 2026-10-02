<?php
// scripts/fix_remaining_migrations.php
// Checks remaining pending migrations and marks ones with existing tables

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Fixing Remaining Migrations ===\n\n";

// Get all tables
$existingTablesResult = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
$existingTables = array_map(fn($row) => $row->tablename, $existingTablesResult);

// Check specific migrations
$migrationsToCheck = [
    ['2025_07_13_000001_create_suppliers_table', 'suppliers'],
    ['2025_07_18_115044_add_missing_message_types', null], // Alters enum, no new table
    ['2025_10_22_141500_fix_product_packaging_units_unique_constraint', null], // Constraint fix only
];

foreach ($migrationsToCheck as [$migration, $table]) {
    $alreadyMarked = DB::table('migrations')->where('migration', $migration)->exists();
    
    if ($alreadyMarked) {
        echo "✓ Already marked: $migration\n";
        continue;
    }
    
    if ($table === null) {
        // Migrations that don't create new tables - mark as completed
        DB::table('migrations')->insert(['migration' => $migration, 'batch' => 1]);
        echo "✓ Marked (special/alter): $migration\n";
    } elseif (in_array($table, $existingTables)) {
        DB::table('migrations')->insert(['migration' => $migration, 'batch' => 1]);
        echo "✓ Marked (table exists): $migration\n";
    } else {
        echo "⊘ Skipped (table missing): $migration - table '$table'\n";
    }
}

echo "\nDone!\n";
