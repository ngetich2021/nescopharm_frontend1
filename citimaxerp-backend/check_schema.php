<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

echo "Listing tables...\n";
$tables = DB::select('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != \'pg_catalog\' AND schemaname != \'information_schema\'');
foreach ($tables as $table) {
    echo $table->tablename . "\n";
}

echo "\nChecking 'logistics' again...\n";
if (Schema::hasTable('logistics')) {
    echo "Table 'logistics' exists.\n";
    $columns = Schema::getColumnListing('logistics');
    print_r($columns);
} else {
    echo "Table 'logistics' DOES NOT exist.\n";
}
