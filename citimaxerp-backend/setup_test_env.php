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

$user = User::where('email', 'inchwara@gmail.com')->first();
if (!$user) {
    echo "USER NOT FOUND\n";
    exit(1);
}

$company = Company::find($user->company_id);
if (!$company) {
    // If no company, create one
    $company = Company::create([
        'id' => Str::uuid(),
        'name' => 'Test Company',
        'email' => 'test@example.com',
        'phone' => '123456789'
    ]);
    $user->company_id = $company->id;
    $user->save();
}

$store = Store::where('company_id', $company->id)->first();
if (!$store) {
    $store = Store::create([
        'id' => Str::uuid(),
        'name' => 'Test Store',
        'company_id' => $company->id,
        'location' => 'Test Location',
        'is_active' => true
    ]);
}

$category = ProductCategory::where('company_id', $company->id)->first();
if (!$category) {
    $category = ProductCategory::create([
        'id' => Str::uuid(),
        'name' => 'Test Category',
        'company_id' => $company->id,
        'description' => 'Test Category Description'
    ]);
}

$token = $user->createToken('test-token')->plainTextToken;

echo "TOKEN=" . $token . "\n";
echo "STORE_ID=" . $store->id . "\n";
echo "CATEGORY_ID=" . $category->id . "\n";
echo "COMPANY_ID=" . $company->id . "\n";
