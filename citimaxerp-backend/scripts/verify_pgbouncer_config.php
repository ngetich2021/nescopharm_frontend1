#!/usr/bin/env php
<?php

/**
 * Supabase PgBouncer Configuration Verification Script
 * 
 * This script verifies that the database is correctly configured
 * to work with Supabase's PgBouncer connection pooler.
 */

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "\n";
echo "=================================================\n";
echo "  Supabase PgBouncer Configuration Check\n";
echo "=================================================\n\n";

$allPassed = true;

// Test 1: PDO::ATTR_EMULATE_PREPARES
echo "1. Checking PDO::ATTR_EMULATE_PREPARES...\n";
try {
    $pdo = DB::connection()->getPdo();
    $emulatedPrepares = $pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES);
    
    if ($emulatedPrepares) {
        echo "   ✓ PASS: Emulated prepares is ENABLED\n";
    } else {
        echo "   ✗ FAIL: Emulated prepares is DISABLED (must be enabled for PgBouncer)\n";
        $allPassed = false;
    }
} catch (Exception $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Test 2: PDO::ATTR_PERSISTENT
echo "\n2. Checking PDO::ATTR_PERSISTENT...\n";
try {
    $persistent = $pdo->getAttribute(PDO::ATTR_PERSISTENT);
    
    if (!$persistent) {
        echo "   ✓ PASS: Persistent connections are DISABLED\n";
    } else {
        echo "   ✗ FAIL: Persistent connections are ENABLED (must be disabled for PgBouncer)\n";
        $allPassed = false;
    }
} catch (Exception $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Test 3: Database connectivity
echo "\n3. Checking database connectivity...\n";
try {
    $result = DB::select('SELECT 1 as test');
    if ($result[0]->test == 1) {
        echo "   ✓ PASS: Database connection successful\n";
    }
} catch (Exception $e) {
    echo "   ✗ FAIL: Database connection failed\n";
    echo "   Error: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Test 4: Multiple queries (simulating prepared statement reuse)
echo "\n4. Testing multiple queries (prepared statement simulation)...\n";
try {
    // Execute the same query multiple times
    for ($i = 1; $i <= 5; $i++) {
        $count = DB::table('users')->count();
        echo "   Query {$i}: Found {$count} users\n";
    }
    echo "   ✓ PASS: Multiple queries executed successfully\n";
} catch (Exception $e) {
    echo "   ✗ FAIL: Multiple queries failed\n";
    echo "   Error: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Test 5: Check connection URL
echo "\n5. Checking database connection configuration...\n";
try {
    $config = config('database.connections.pgsql');
    $databaseUrl = env('DATABASE_URL');
    
    if (strpos($databaseUrl, 'pooler.supabase.com:6543') !== false) {
        echo "   ✓ PASS: Using Supabase connection pooler (port 6543)\n";
    } elseif (strpos($databaseUrl, 'supabase.com:5432') !== false) {
        echo "   ⚠ WARNING: Using direct connection (port 5432) - pooler recommended\n";
    }
    
    if (isset($config['options'][PDO::ATTR_EMULATE_PREPARES]) && 
        $config['options'][PDO::ATTR_EMULATE_PREPARES] === true) {
        echo "   ✓ PASS: Config has emulated prepares enabled\n";
    } else {
        echo "   ✗ FAIL: Config does not have emulated prepares enabled\n";
        $allPassed = false;
    }
} catch (Exception $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Test 6: Transaction test
echo "\n6. Testing transaction handling...\n";
try {
    DB::beginTransaction();
    $testCount = DB::table('users')->count();
    DB::rollBack();
    echo "   ✓ PASS: Transactions work correctly\n";
} catch (Exception $e) {
    DB::rollBack();
    echo "   ✗ FAIL: Transaction test failed\n";
    echo "   Error: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Summary
echo "\n";
echo "=================================================\n";
if ($allPassed) {
    echo "  ✓ ALL TESTS PASSED\n";
    echo "  Your database is correctly configured for\n";
    echo "  Supabase PgBouncer connection pooling.\n";
    echo "=================================================\n\n";
    exit(0);
} else {
    echo "  ✗ SOME TESTS FAILED\n";
    echo "  Please review the errors above and check:\n";
    echo "  - config/database.php\n";
    echo "  - app/Providers/AppServiceProvider.php\n";
    echo "  - Run: php artisan config:clear\n";
    echo "=================================================\n\n";
    exit(1);
}
