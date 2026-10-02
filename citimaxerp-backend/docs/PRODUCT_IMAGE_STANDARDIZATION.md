# Product Image Storage Standardization Guide

## Overview

This guide documents the standardized approach for storing and managing product and product variant images using Supabase Storage.

## Storage Strategy

### Core Principles

1. **Store file paths, not URLs** in the database
2. **Generate URLs dynamically** when needed for API responses
3. **Use JSONB arrays** (`images`) as the primary storage field
4. **Maintain backward compatibility** with legacy `image_url` field
5. **Centralize image logic** in `ProductImageService`

## Database Schema

### Products Table

```sql
-- Primary storage: array of file paths
images JSONB NULL

-- Legacy field: auto-synced with first image
image_url TEXT NULL

-- Indicates which image in array is primary
primary_image_index INTEGER NOT NULL DEFAULT 0
```

### Product Variants Table

```sql
-- Primary storage: array of file paths
images JSONB NULL

-- Legacy field: auto-synced with first image (added in migration)
image_url TEXT NULL

-- Note: Variants don't have primary_image_index (always use first image)
```

## Storage Format

### File Path Structure

**Products:**
```
products/{YYYY}/{MM}/{DD}/{UUID}.{extension}
```

**Product Variants:**
```
product-variants/{YYYY}/{MM}/{DD}/{UUID}.{extension}
```

### Database Storage (JSONB)

```json
[
  "products/2025/10/31/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  "products/2025/10/31/b2c3d4e5-f6a7-8901-bcde-f2345678901a.png"
]
```

### Public URL Generation

File paths are converted to public URLs when needed:

```
https://{projectId}.supabase.co/storage/v1/object/public/{bucket}/{path}
```

## ProductImageService API

### Core Methods

#### `processImages(array $images, string $type = 'products'): array`

Process mixed array of uploaded files and existing paths.

```php
$imageService = app(ProductImageService::class);
$processedPaths = $imageService->processImages($request->file('images'), 'products');
```

#### `getPublicUrls($paths): array|string|null`

Convert file paths to public URLs.

```php
$urls = $imageService->getPublicUrls($product->images);
// Returns: ['https://...', 'https://...']
```

#### `getPrimaryImageUrl(?array $images, int $primaryIndex = 0): ?string`

Get the primary image URL.

```php
$primaryUrl = $imageService->getPrimaryImageUrl($product->images, $product->primary_image_index);
```

#### `deleteImages(array $imagePaths): array`

Delete images from Supabase storage.

```php
$results = $imageService->deleteImages($product->images);
```

#### `normalizeImagePath(string $imagePathOrUrl): string`

Convert full URLs to relative paths.

```php
$path = $imageService->normalizeImagePath('https://xxx.supabase.co/storage/.../products/2025/10/31/uuid.jpg');
// Returns: 'products/2025/10/31/uuid.jpg'
```

#### `validateImage(UploadedFile $file, int $maxSizeKb = 5120, array $allowedMimes = [...]): array`

Validate image before upload.

```php
$validation = $imageService->validateImage($file);
if (!$validation['valid']) {
    return response()->json(['error' => $validation['error']], 400);
}
```

## Model Integration

### Using the HasProductImages Trait

```php
use App\Traits\HasProductImages;

class Product extends Model
{
    use HasProductImages;
    
    // The trait automatically:
    // - Syncs image_url field when images array changes
    // - Provides image_urls accessor for public URLs
    // - Provides primary_image_url accessor
    // - Provides processAndStoreImages() helper
    // - Provides deleteImages() helper
}
```

### Model Accessors (Available on Both Product and ProductVariant)

#### `$model->image_urls`

Get array of public URLs for all images.

```php
$product->image_urls;
// Returns: ['https://...', 'https://...']
```

#### `$model->primary_image_url`

Get public URL of primary image.

```php
$product->primary_image_url;
// Returns: 'https://...'
```

## Controller Usage

### Creating Products with Images

```php
public function store(Request $request)
{
    $imageService = app(ProductImageService::class);
    
    // Process uploaded images
    $imagePaths = [];
    if ($request->hasFile('images')) {
        $imagePaths = $imageService->processImages(
            $request->file('images'), 
            'products'
        );
    }
    
    $product = Product::create([
        'name' => $request->name,
        'images' => $imagePaths,
        'primary_image_index' => $request->input('primary_image_index', 0),
        // ... other fields
    ]);
    
    // image_url is automatically synced by the trait
    
    return response()->json($product);
}
```

### Updating Products with Images

```php
public function update(Request $request, $id)
{
    $product = Product::findOrFail($id);
    $imageService = app(ProductImageService::class);
    
    // Handle mixed new uploads and existing paths
    $images = [];
    
    if ($request->hasFile('images')) {
        $images = $imageService->processImages(
            $request->file('images'), 
            'products'
        );
    } elseif ($request->has('images')) {
        // Preserve existing paths
        $images = $imageService->processImages(
            $request->input('images'), 
            'products'
        );
    }
    
    if (!empty($images)) {
        $product->images = $images;
    }
    
    $product->save();
    
    return response()->json($product);
}
```

### Creating Variants with Images

```php
foreach ($request->variations as $index => $variantData) {
    $variantImages = [];
    
    if ($request->hasFile("variations.{$index}.images")) {
        $variantImages = $imageService->processImages(
            $request->file("variations.{$index}.images"),
            'product-variants'
        );
    }
    
    ProductVariant::create([
        'product_id' => $product->id,
        'name' => $variantData['name'],
        'images' => $variantImages,
        // ... other fields
    ]);
}
```

### API Response Formatting

```php
public function show($id)
{
    $product = Product::with('variants')->findOrFail($id);
    
    return response()->json([
        'product' => [
            'id' => $product->id,
            'name' => $product->name,
            'images' => $product->images, // File paths
            'image_urls' => $product->image_urls, // Public URLs
            'primary_image_url' => $product->primary_image_url,
            'variants' => $product->variants->map(function ($variant) {
                return [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'images' => $variant->images,
                    'image_urls' => $variant->image_urls,
                    'primary_image_url' => $variant->primary_image_url,
                ];
            }),
        ]
    ]);
}
```

## Migration Strategy

### Step 1: Add image_url to product_variants

```bash
php artisan migrate
```

This runs the migration: `2025_10_31_000001_add_image_url_to_product_variants.php`

### Step 2: Update Existing Records (Optional Data Migration)

If you have existing products/variants with `image_url` that need to be converted to the `images` array format:

```php
// Create a migration or artisan command
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\ProductImageService;

$imageService = app(ProductImageService::class);

// Migrate products
Product::whereNotNull('image_url')
    ->whereNull('images')
    ->chunk(100, function ($products) use ($imageService) {
        foreach ($products as $product) {
            $path = $imageService->normalizeImagePath($product->image_url);
            $product->images = [$path];
            $product->save();
        }
    });

// Migrate variants
ProductVariant::whereNotNull('image_url')
    ->whereNull('images')
    ->chunk(100, function ($variants) use ($imageService) {
        foreach ($variants as $variant) {
            $path = $imageService->normalizeImagePath($variant->image_url);
            $variant->images = [$path];
            $variant->save();
        }
    });
```

### Step 3: Update Frontend

Update frontend code to use `image_urls` or `primary_image_url` instead of `image_url`.

## Best Practices

### 1. Always Store Paths, Never URLs

```php
// ✅ CORRECT
$product->images = ['products/2025/10/31/uuid.jpg'];

// ❌ WRONG
$product->images = ['https://xxx.supabase.co/storage/.../products/2025/10/31/uuid.jpg'];
```

### 2. Use the Service for All Image Operations

```php
// ✅ CORRECT
$imageService = app(ProductImageService::class);
$paths = $imageService->processImages($files, 'products');

// ❌ WRONG
$path = 'products/' . time() . '.jpg';
$this->supabase->uploadFile($file, $path);
```

### 3. Validate Before Upload

```php
$imageService = app(ProductImageService::class);

foreach ($request->file('images') as $file) {
    $validation = $imageService->validateImage($file);
    if (!$validation['valid']) {
        return response()->json(['error' => $validation['error']], 400);
    }
}
```

### 4. Clean Up on Delete

```php
public function destroy($id)
{
    $product = Product::findOrFail($id);
    
    // Delete images from storage
    $product->deleteImages();
    
    // Delete product
    $product->delete();
    
    return response()->json(['message' => 'Deleted successfully']);
}
```

### 5. Handle Bulk Operations

```php
// For bulk operations, process images in batches
$products = [];
foreach ($request->products as $productData) {
    if (isset($productData['images'])) {
        $productData['images'] = $imageService->processImages(
            $productData['images'],
            'products'
        );
    }
    $products[] = Product::create($productData);
}
```

## API Examples

### Create Product with Images

```http
POST /api/products
Content-Type: multipart/form-data

name: "Test Product"
price: 99.99
images[]: [File]
images[]: [File]
primary_image_index: 0
```

### Update Product - Add New Image

```http
PUT /api/products/123
Content-Type: multipart/form-data

images[]: "products/2025/10/31/existing-uuid.jpg"  # Keep existing
images[]: [File]  # Add new
```

### Response Format

```json
{
  "id": "uuid",
  "name": "Test Product",
  "images": [
    "products/2025/10/31/a1b2c3d4.jpg",
    "products/2025/10/31/b2c3d4e5.png"
  ],
  "image_url": "https://xxx.supabase.co/.../products/2025/10/31/a1b2c3d4.jpg",
  "image_urls": [
    "https://xxx.supabase.co/.../products/2025/10/31/a1b2c3d4.jpg",
    "https://xxx.supabase.co/.../products/2025/10/31/b2c3d4e5.png"
  ],
  "primary_image_url": "https://xxx.supabase.co/.../products/2025/10/31/a1b2c3d4.jpg",
  "primary_image_index": 0
}
```

## Troubleshooting

### Issue: Images showing as null

**Solution:** Ensure the `images` cast is set in the model:

```php
protected $casts = [
    'images' => 'array',
];
```

### Issue: URLs not generating

**Solution:** Check Supabase configuration in `config/services.php`:

```php
'supabase' => [
    'project_id' => env('SUPABASE_PROJECT_ID'),
    'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY'),
    'storage_bucket' => env('SUPABASE_STORAGE_BUCKET', 'chat-media'),
],
```

### Issue: Old URLs in database

**Solution:** Use `normalizeImagePath()` to convert them:

```php
$imageService = app(ProductImageService::class);
$normalized = array_map(
    fn($img) => $imageService->normalizeImagePath($img),
    $product->images
);
$product->images = $normalized;
$product->save();
```

## Summary

- **Database**: Store file paths in JSONB `images` array
- **Legacy**: Auto-sync `image_url` with first image
- **Service**: Use `ProductImageService` for all operations
- **Models**: Use `HasProductImages` trait for helpers
- **API**: Return both paths and URLs in responses
- **Frontend**: Use `image_urls` or `primary_image_url` accessors
