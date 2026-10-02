<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Store;
use App\Models\ProductCategory;
use App\Models\Company;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

$user = User::where('email', 'inchwara@gmail.com')->first();
if (!$user) {
    echo "USER NOT FOUND\n";
    exit(1);
}

$company = Company::find($user->company_id);
if (!$company) {
    $companyId = (string) Str::uuid();
    DB::table('companies')->insert([
        'id' => $companyId,
        'name' => 'Test Company',
        'email' => 'test@example.com',
        'phone' => '123456789',
        'created_at' => now(),
        'updated_at' => now()
    ]);
    $user->company_id = $companyId;
    $user->save();
    $company = Company::find($companyId);
}

$store = Store::where('company_id', $company->id)->first();
if (!$store) {
    $storeId = (string) Str::uuid();
    DB::table('stores')->insert([
        'id' => $storeId,
        'name' => 'Test Store',
        'company_id' => $company->id,
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now()
    ]);
    $store = Store::find($storeId);
}

$category = ProductCategory::where('company_id', $company->id)->first();
if (!$category) {
    $categoryId = (string) Str::uuid();
    DB::table('product_categories')->insert([
        'id' => $categoryId,
        'name' => 'Test Category',
        'company_id' => $company->id,
        'description' => 'Test Category Description',
        'created_at' => now(),
        'updated_at' => now()
    ]);
    $category = ProductCategory::find($categoryId);
}

$token = $user->createToken('test-token')->plainTextToken;

echo "TOKEN=" . $token . "\n";
echo "STORE_ID=" . $store->id . "\n";
echo "CATEGORY_ID=" . $category->id . "\n";
echo "COMPANY_ID=" . $company->id . "\n";
