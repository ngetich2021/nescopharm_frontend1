<?php
// scripts/smart_mark_migrations.php
// Intelligently marks migrations as run ONLY if their tables already exist in the database

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

echo "=== Smart Migration Marker ===\n\n";

// Get all existing tables from database
echo "1. Fetching existing tables from database...\n";
$existingTablesResult = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
$existingTables = array_map(fn($row) => $row->tablename, $existingTablesResult);
echo "   Found " . count($existingTables) . " tables in database\n\n";

// Get all migration files
echo "2. Reading migration files...\n";
$migrationFiles = File::files(database_path('migrations'));
echo "   Found " . count($migrationFiles) . " migration files\n\n";

$markedCount = 0;
$skippedCount = 0;

echo "3. Analyzing migrations and marking completed ones...\n\n";

foreach ($migrationFiles as $file) {
    $migrationName = pathinfo($file->getFilename(), PATHINFO_FILENAME);
    $content = file_get_contents($file->getPathname());
    
    // Extract table names from the migration using regex
    // Look for Schema::create, Schema::table, Schema::rename patterns
    preg_match_all('/Schema::(create|table|rename)\s*\(\s*[\'"]([^\'"\)]+)[\'"]/i', $content, $matches);
    
    $tablesInMigration = array_unique($matches[2] ?? []);
    
    if (empty($tablesInMigration)) {
        // Special cases - migrations that don't create/modify specific tables (extensions, etc)
        // Mark these as run by default
        if (strpos($migrationName, 'enable_uuid_extension') !== false ||
            strpos($migrationName, 'add_performance_indexes') !== false ||
            strpos($migrationName, 'drop_') !== false ||
            strpos($migrationName, 'remove_') !== false) {
            
            DB::table('migrations')->insert(['migration' => $migrationName, 'batch' => 1]);
            echo "✓ Marked (special): $migrationName\n";
            $markedCount++;
            continue;
        }
        
        echo "⊘ Skipped (no tables detected): $migrationName\n";
        $skippedCount++;
        continue;
    }
    
    // Check if ALL tables from this migration exist
    $allTablesExist = true;
    foreach ($tablesInMigration as $table) {
        if (!in_array($table, $existingTables)) {
            $allTablesExist = false;
            break;
        }
    }
    
    if ($allTablesExist) {
        DB::table('migrations')->insert(['migration' => $migrationName, 'batch' => 1]);
        echo "✓ Marked: $migrationName (tables: " . implode(', ', $tablesInMigration) . ")\n";
        $markedCount++;
    } else {
        echo "⊘ Skipped: $migrationName (tables: " . implode(', ', $tablesInMigration) . ") - NOT all exist\n";
        $skippedCount++;
    }
}

echo "\n=== Summary ===\n";
echo "Marked as completed: $markedCount migrations\n";
echo "Left pending: $skippedCount migrations\n";
echo "\nDone! Run 'php artisan migrate:status' to verify.\n";
