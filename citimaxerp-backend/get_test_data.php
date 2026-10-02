<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Store;
use App\Models\ProductCategory;
use App\Models\Supplier;

$user = User::first();
$store = Store::first();
$category = ProductCategory::first();
$supplier = Supplier::first();

echo "USER_ID=" . ($user ? $user->id : 'none') . "\n";
echo "USER_EMAIL=" . ($user ? $user->email : 'none') . "\n";
echo "STORE_ID=" . ($store ? $store->id : 'none') . "\n";
echo "CATEGORY_ID=" . ($category ? $category->id : 'none') . "\n";
echo "SUPPLIER_ID=" . ($supplier ? $supplier->id : 'none') . "\n";
