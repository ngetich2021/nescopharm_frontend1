<?php
// scripts/mark_migrations.php
// Boots the Laravel app and inserts any missing migration filenames into the `migrations` table

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';

// Bootstrap the kernel so config and facades are available
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

echo "Looking for migration files...\n";
$files = File::files(database_path('migrations'));
$count = 0;
foreach ($files as $file) {
    $name = pathinfo($file->getFilename(), PATHINFO_FILENAME);
    $exists = DB::table('migrations')->where('migration', $name)->exists();
    if (!$exists) {
        DB::table('migrations')->insert(['migration' => $name, 'batch' => 999]);
        echo "Inserted: $name\n";
        $count++;
    }
}

if ($count === 0) {
    echo "No missing migrations found.\n";
} else {
    echo "Inserted $count migration(s).\n";
}

echo "Done.\n";
