<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * INSTRUCTIONS:
 * 1. Fill in the UUIDs below.
 * 2. Ensure an image file exists at the path specified in $imagePath.
 * 3. Run with: php test_product_creation.php
 */

$userEmail = 'inchwara@gmail.com'; // User to authenticate as
$token = '3|Lz9kLZaN4Ll2bsuXSZngWuHhqQAedqTuXDwOxNt65db54092';
$companyId = 'ef6df756-29ac-4153-a4c4-cc702c7956bd';
$storeId = 'b28c9b40-e0ee-4f88-8096-86cf37fb7e75';
$categoryId = 'e5b0ace0-1dbe-4f0e-9afb-9cdecf74d979';
$imagePath = __DIR__ . '/test_product_image.png'; // Path to the copied image

// --- EXECUTION ---

$user = User::where('email', $userEmail)->first();
if (!$user) {
    die("User not found: $userEmail\n");
}

// Mock authentication
auth()->login($user);

// Prepare image
if (!file_exists($imagePath)) {
    die("Image not found at $imagePath. Please provide a real image file.\n");
}

$file = new UploadedFile(
    $imagePath,
    basename($imagePath),
    'image/png',
    null,
    true // Test mode
);

// Prepare request data
$data = [
    'name' => 'Test Product ' . time(),
    'company_id' => $companyId,
    'store_id' => $storeId,
    'category_id' => $categoryId,
    'price' => 1500.00,
    'unit_cost' => 1000.00,
    'stock_quantity' => 100,
    'sku' => 'SKU-' . time(),
    'is_active' => true,
    'track_inventory' => true,
    'images' => [$file] // ProductController handles array of images
];

// Create request object
$request = Request::create('/api/products', 'POST', $data, [], ['images' => [$file]]);
$request->setUserResolver(fn() => $user);

echo "Attempting to create product...\n";

try {
    $controller = app(\App\Http\Controllers\ProductController::class);
    $response = $controller->store($request);

    echo "Status Code: " . $response->getStatusCode() . "\n";
    echo "Response Body: \n";
    print_r(json_decode($response->getContent(), true));

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
