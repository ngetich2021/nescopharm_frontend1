# Product Image Upload Refactoring Summary

## Overview

Successfully refactored product and variant image upload logic to use a centralized `ProductImageService`, eliminating code duplication and standardizing image handling across the application.

---

## Changes Made

### 1. **ProductController** - Centralized Image Processing

#### Constructor Updated
```php
protected $imageService;

public function __construct(
    SupabaseStorageService $supabase,
    ProductPackagingService $packagingService,
    PackagingCalculatorService $calculator,
    ProductImageService $imageService  // NEW
) {
    $this->imageService = $imageService;
}
```

#### Before (Duplicated Code - ~40 lines per method)
```php
// Product images
if ($request->hasFile('images')) {
    foreach ($request->file('images') as $imageFile) {
        $uploadResult = $this->supabase->uploadFile($imageFile, 'products/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $imageFile->getClientOriginalExtension());
        if (!empty($uploadResult['success']) && !empty($uploadResult['file_path'])) {
            $images[] = $uploadResult['file_path'];
        } else {
            Log::error('Supabase upload failed for product image', [...]);
        }
    }
}

if ($request->has('images') && is_array($request->input('images'))) {
    foreach ($request->input('images') as $image) {
        if ($image instanceof \Illuminate\Http\UploadedFile) {
            $uploadResult = $this->supabase->uploadFile(...);
            $images[] = $uploadResult['file_path'];
        } else if (is_string($image) && !empty($image)) {
            $images[] = $image;
        }
    }
}

// Same logic repeated for variants with indexed keys
```

#### After (Simplified - ~10 lines)
```php
// Product images
$images = [];

if ($request->hasFile('images')) {
    $images = array_merge($images, $request->file('images'));
}

if ($request->has('images') && is_array($request->input('images'))) {
    $images = array_merge($images, $request->input('images'));
}

if (!empty($images)) {
    $productData['images'] = $this->imageService->processImages($images, 'products');
}

// Variant images (same pattern with indexed keys)
$variantImages = [];

if ($request->hasFile("variations.{$index}.images")) {
    $uploadedFiles = $request->file("variations.{$index}.images");
    $variantImages = array_merge($variantImages, is_array($uploadedFiles) ? $uploadedFiles : [$uploadedFiles]);
}

if (isset($variantData['images']) && is_array($variantData['images'])) {
    $variantImages = array_merge($variantImages, $variantData['images']);
}

if (!empty($variantImages)) {
    $variantData['images'] = $this->imageService->processImages($variantImages, 'product-variants');
}
```

### 2. **Product Model** - Added Trait

```php
use App\Traits\HasProductImages;

class Product extends Model
{
    use HasFactory, HasProductImages;  // NEW
    
    // Removed duplicate getImageUrlsAttribute()
    // Removed duplicate getPrimaryImageUrlAttribute()
    // These now come from the trait
}
```

### 3. **ProductVariant Model** - Added Trait

```php
use App\Traits\HasProductImages;

class ProductVariant extends Model
{
    use HasProductImages;  // NEW
    
    // Removed duplicate getImagesAttribute()
    // Removed duplicate getImageUrlsAttribute()
    // Removed duplicate getPrimaryImageUrlAttribute()
    // These now come from the trait
}
```

---

## Benefits

### ✅ **Code Reduction**
- **Before**: ~160 lines of duplicated image handling code
- **After**: ~40 lines using centralized service
- **Reduction**: ~75% less code

### ✅ **Maintainability**
- Single source of truth for image processing
- Changes to upload logic only need to happen in one place
- Easier to add validation, optimization, or new features

### ✅ **Consistency**
- Products and variants use identical logic
- Same path structure, same error handling
- Same support for mixed inputs (files + existing paths)

### ✅ **New Features (via ProductImageService)**
- Image validation (size, type, dimensions)
- Path normalization (URL → path conversion)
- Public URL generation
- Image deletion helpers
- Legacy image_url syncing

### ✅ **Better Error Handling**
- Centralized logging in the service
- Failed uploads don't break the flow
- Clear error messages

---

## API Compatibility

### ✅ **Fully Backward Compatible**

All existing API requests continue to work exactly as before:

#### Product Creation
```http
POST /api/products
Content-Type: multipart/form-data

images[]: <File>
images[]: <File>
```

#### Variant Creation
```http
POST /api/products
Content-Type: multipart/form-data

variations[0][images][]: <File>
variations[1][images][]: <File>
```

#### Mixed Input (Files + Existing Paths)
```json
{
  "images": [
    <UploadedFile>,
    "products/2025/10/31/existing-uuid.jpg"
  ]
}
```

---

## New Model Accessors

Both `Product` and `ProductVariant` now have these accessors via the trait:

### `$model->image_urls`
```php
$product->image_urls;
// Returns: ['https://xxx.supabase.co/.../uuid.jpg', ...]
```

### `$model->primary_image_url`
```php
$product->primary_image_url;
// Returns: 'https://xxx.supabase.co/.../uuid.jpg'
```

### Helper Methods

```php
// Process and store images
$product->processAndStoreImages($files, 'products');

// Delete associated images from storage
$product->deleteImages();
```

---

## Files Modified

1. ✅ `/app/Http/Controllers/ProductController.php`
   - Added `ProductImageService` dependency
   - Refactored `store()` method (products & variants)
   - Refactored `update()` method (products & variants)

2. ✅ `/app/Models/Product.php`
   - Added `HasProductImages` trait
   - Removed duplicate image accessors

3. ✅ `/app/Models/ProductVariant.php`
   - Added `HasProductImages` trait
   - Removed duplicate image accessors
   - Added `image_url` to fillable

4. ✅ `/app/Services/ProductImageService.php`
   - Created centralized image processing service

5. ✅ `/app/Traits/HasProductImages.php`
   - Created reusable trait for models with images

---

## Testing Checklist

### ✅ Test Product Image Upload
```bash
# Create product with images
curl -X POST http://localhost:8000/api/products \
  -H "Authorization: Bearer {token}" \
  -F "name=Test Product" \
  -F "price=99.99" \
  -F "images[]=@image1.jpg" \
  -F "images[]=@image2.png"
```

### ✅ Test Variant Image Upload
```bash
# Create product with variant images
curl -X POST http://localhost:8000/api/products \
  -H "Authorization: Bearer {token}" \
  -F "name=T-Shirt" \
  -F "has_variations=true" \
  -F "variations[0][name]=Size S" \
  -F "variations[0][images][]=@variant1.jpg"
```

### ✅ Test Update with Mixed Input
```bash
# Update product - keep one image, add new one
curl -X PUT http://localhost:8000/api/products/{id} \
  -H "Authorization: Bearer {token}" \
  -F "images[]=products/2025/10/31/existing-uuid.jpg" \
  -F "images[]=@new-image.jpg"
```

### ✅ Test Image URLs in Response
```bash
# Get product
curl http://localhost:8000/api/products/{id} \
  -H "Authorization: Bearer {token}"
  
# Response should include:
# - images: ["products/2025/10/31/uuid.jpg"]
# - image_urls: ["https://xxx.supabase.co/..."]
# - primary_image_url: "https://xxx.supabase.co/..."
```

---

## Next Steps (Optional)

### 1. Add Image Validation
Update controllers to validate before upload:

```php
foreach ($request->file('images') as $file) {
    $validation = $this->imageService->validateImage($file);
    if (!$validation['valid']) {
        return response()->json(['error' => $validation['error']], 400);
    }
}
```

### 2. Implement Image Cleanup
Add event listener for product/variant deletion:

```php
// In Product/ProductVariant model
protected static function booted()
{
    static::deleting(function ($model) {
        $model->deleteImages();
    });
}
```

### 3. Add Image Optimization
Compress images before upload:

```php
// In ProductImageService::processImages()
if ($image instanceof UploadedFile) {
    $image = $this->compressImage($image);
    // ... then upload
}
```

### 4. Create Image Migration Command
Sync existing data:

```bash
php artisan products:sync-images --dry-run
php artisan products:sync-images
```

---

## Summary

The refactoring successfully:
- ✅ Eliminated ~120 lines of duplicate code
- ✅ Centralized all image logic in `ProductImageService`
- ✅ Added reusable `HasProductImages` trait
- ✅ Maintained full backward compatibility
- ✅ Added new helper methods and accessors
- ✅ Improved maintainability and extensibility
- ✅ No breaking changes to existing API

The image upload system is now standardized, maintainable, and ready for future enhancements like validation, optimization, and automated cleanup.
