# Product & Variant Image Upload Analysis

## Overview

This document analyzes how product and product variant images are currently uploaded in the ProductController. Both follow a similar dual-input pattern.

---

## Product Image Upload (Lines 247-286)

### Two-Step Processing Pattern

#### **Step 1: Handle Direct File Uploads**

```php
if ($request->hasFile('images')) {
    foreach ($request->file('images') as $imageFile) {
        $uploadResult = $this->supabase->uploadFile(
            $imageFile, 
            'products/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $imageFile->getClientOriginalExtension()
        );
        
        if (!empty($uploadResult['success']) && !empty($uploadResult['file_path'])) {
            $images[] = $uploadResult['file_path'];
        }
    }
}
```

**What happens:**
1. Checks if files are uploaded via `hasFile('images')`
2. Loops through each uploaded file
3. Generates path: `products/2025/10/31/{uuid}.jpg`
4. Uploads to Supabase Storage
5. Stores **file path** (not URL) in `$images` array

#### **Step 2: Handle Form Data (Mixed Files & Strings)**

```php
if ($request->has('images') && is_array($request->input('images'))) {
    foreach ($request->input('images') as $image) {
        if ($image instanceof \Illuminate\Http\UploadedFile) {
            // Upload new file
            $uploadResult = $this->supabase->uploadFile(...);
            $images[] = $uploadResult['file_path'];
        } 
        else if (is_string($image) && !empty($image)) {
            // Keep existing path/URL as-is
            $images[] = $image;
        }
    }
}
```

**What happens:**
1. Checks if `images` exists in request data (not files)
2. Handles **two types** of input:
   - **UploadedFile objects** → Upload to Supabase
   - **String paths/URLs** → Keep as-is (preserving existing images)
3. Allows mixing new uploads with existing images

#### **Step 3: Store in Database**

```php
$productData['images'] = $images;

$product = Product::create([
    'images' => $productData['images'] ?? [],
    // ... other fields
]);
```

**Result:** JSONB array of file paths stored in database

---

## Product Variant Image Upload (Lines 336-383)

### Same Two-Step Pattern, But with Index

#### **Step 1: Handle Direct File Uploads (Indexed)**

```php
if ($request->hasFile("variations.{$index}.images")) {
    $uploadedFiles = $request->file("variations.{$index}.images");
    
    // Ensure array format
    if (!is_array($uploadedFiles)) {
        $uploadedFiles = [$uploadedFiles];
    }
    
    foreach ($uploadedFiles as $variantImage) {
        $uploadResult = $this->supabase->uploadFile(
            $variantImage, 
            'product-variants/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $variantImage->getClientOriginalExtension()
        );
        
        if (!empty($uploadResult['success']) && !empty($uploadResult['file_path'])) {
            $variantImages[] = $uploadResult['file_path'];
        }
    }
}
```

**Key Difference:**
- Uses **indexed key**: `variations.{$index}.images`
- Example: `variations.0.images`, `variations.1.images`
- Path prefix: `product-variants/` instead of `products/`

#### **Step 2: Handle Form Data (Mixed Files & Strings)**

```php
else if (isset($variantData['images']) && is_array($variantData['images'])) {
    foreach ($variantData['images'] as $variantImage) {
        if ($variantImage instanceof \Illuminate\Http\UploadedFile) {
            // Upload new file
            $uploadResult = $this->supabase->uploadFile(...);
            $variantImages[] = $uploadResult['file_path'];
        } 
        else if (is_string($variantImage) && !empty($variantImage)) {
            // Keep existing path
            $variantImages[] = $variantImage;
        }
    }
}
```

**Same logic as products**, just accessing from `$variantData['images']`

#### **Step 3: Store in Variant**

```php
if (!empty($variantImages)) {
    $variantData['images'] = $variantImages;
}

ProductVariant::create(array_merge($variantData, [
    'id' => Str::uuid(),
    'product_id' => $product->id,
    // ... other fields
]));
```

---

## Update Operations

### Product Update (Lines 573-618)

**Same pattern** as create, but with additional check:

```php
if (!empty($images) || $request->has('images')) {
    $updateData['images'] = $images;
}
```

**Behavior:**
- Only updates images if new ones provided
- Preserves existing images if not specified
- Can mix new uploads with existing paths

### Variant Update (Lines 647-698)

**Same pattern** as create with indexed keys:

```php
if ($request->hasFile("variations.{$index}.images")) {
    // Process new uploads
}
else if (isset($variantData['images']) && is_array($variantData['images'])) {
    // Process mixed data
}
```

---

## Request Input Formats

### Product Creation/Update

#### Format 1: Direct File Upload (multipart/form-data)
```http
POST /api/products
Content-Type: multipart/form-data

images[]: <File>
images[]: <File>
```

#### Format 2: Mixed (JSON or form-data)
```json
{
  "images": [
    <UploadedFile>,
    "products/2025/10/31/existing-uuid.jpg"
  ]
}
```

#### Format 3: Preserve Existing
```json
{
  "images": [
    "products/2025/10/31/existing-uuid.jpg",
    "products/2025/10/30/another-uuid.jpg"
  ]
}
```

### Variant Creation/Update

#### Format 1: Direct File Upload (indexed)
```http
POST /api/products
Content-Type: multipart/form-data

variations[0][name]: "Size S"
variations[0][images][]: <File>
variations[0][images][]: <File>
variations[1][name]: "Size M"
variations[1][images][]: <File>
```

#### Format 2: Mixed
```json
{
  "variations": [
    {
      "name": "Size S",
      "images": [
        <UploadedFile>,
        "product-variants/2025/10/31/existing-uuid.jpg"
      ]
    }
  ]
}
```

---

## Comparison: Products vs Variants

| Aspect | Products | Variants |
|--------|----------|----------|
| **Input Key** | `images` | `variations.{index}.images` |
| **Path Prefix** | `products/` | `product-variants/` |
| **Path Structure** | `products/YYYY/MM/DD/uuid.ext` | `product-variants/YYYY/MM/DD/uuid.ext` |
| **Storage Field** | `products.images` (JSONB) | `product_variants.images` (JSONB) |
| **Processing Logic** | Same dual-step pattern | Same dual-step pattern |
| **Update Behavior** | Preserve if not specified | Preserve if not specified |

---

## Upload Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Request                           │
│  - images[] = [File, File]  OR                             │
│  - variations[0][images][] = [File]                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ProductController                              │
│                                                             │
│  Step 1: Check hasFile('images') or                        │
│          hasFile('variations.{index}.images')              │
│          ↓                                                  │
│  Step 2: Loop through each file                            │
│          ↓                                                  │
│  Step 3: Generate path: {type}/YYYY/MM/DD/uuid.ext        │
│          ↓                                                  │
│  Step 4: Call $this->supabase->uploadFile()               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           SupabaseStorageService                            │
│                                                             │
│  - Read file content                                        │
│  - Detect MIME type                                         │
│  - HTTP POST to Supabase Storage API                       │
│  - Return: ['success' => true, 'file_path' => '...']      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Storage                               │
│                                                             │
│  URL: https://{projectId}.supabase.co/storage/v1/object/   │
│       {bucket}/{path}                                       │
│                                                             │
│  Stores: Physical file in bucket                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                            │
│                                                             │
│  products.images:          ["products/2025/10/31/uuid.jpg"] │
│  product_variants.images:  ["product-variants/.../uuid.jpg"]│
│                                                             │
│  Format: JSONB array of file paths (NOT URLs)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Observations

### ✅ **What's Working Well**

1. **Dual Input Support**: Handles both file uploads and existing paths
2. **Path Storage**: Stores paths (not URLs) for flexibility
3. **Error Logging**: Failed uploads are logged but don't break the flow
4. **Preservation**: Existing images can be preserved during updates
5. **Consistent Pattern**: Products and variants use same logic

### ⚠️ **Current Limitations**

1. **No Validation**: No file size, type, or dimension validation
2. **No Cleanup**: Failed uploads aren't rolled back
3. **No Deduplication**: Same file uploaded multiple times creates duplicates
4. **Repetitive Code**: Same logic duplicated for products and variants
5. **Mixed Success Handling**: Partial failures log errors but continue
6. **No Transaction Safety**: If product creation fails, uploaded images remain orphaned

### 🔧 **How They're Different**

| Feature | Product Images | Variant Images |
|---------|---------------|----------------|
| **Request Key** | `images` | `variations.{index}.images` |
| **Fallback Check** | `$request->input('images')` | `$variantData['images']` |
| **Path Prefix** | `products/` | `product-variants/` |
| **Index Handling** | Direct array | Indexed by variant position |
| **Logging** | Less verbose | More verbose (includes index) |

---

## Example Request Handling

### Creating Product with 2 Images and 1 Variant with 1 Image

**Request:**
```http
POST /api/products
Content-Type: multipart/form-data

name=T-Shirt
has_variations=true
images[]=<image1.jpg>
images[]=<image2.png>
variations[0][name]=Size S
variations[0][sku]=TSH-S
variations[0][images][]=<variant1.jpg>
```

**Processing Flow:**

1. **Product Images:**
   ```php
   $request->hasFile('images') → true
   $request->file('images') → [image1.jpg, image2.png]
   
   // Upload image1.jpg
   → 'products/2025/10/31/a1b2c3d4.jpg'
   
   // Upload image2.png
   → 'products/2025/10/31/b2c3d4e5.png'
   
   $images = [
       'products/2025/10/31/a1b2c3d4.jpg',
       'products/2025/10/31/b2c3d4e5.png'
   ]
   ```

2. **Product Created:**
   ```sql
   INSERT INTO products (
       id, name, images, ...
   ) VALUES (
       'uuid-1',
       'T-Shirt',
       '["products/2025/10/31/a1b2c3d4.jpg","products/2025/10/31/b2c3d4e5.png"]',
       ...
   )
   ```

3. **Variant Images:**
   ```php
   $index = 0
   $request->hasFile("variations.0.images") → true
   $request->file("variations.0.images") → [variant1.jpg]
   
   // Upload variant1.jpg
   → 'product-variants/2025/10/31/c3d4e5f6.jpg'
   
   $variantImages = ['product-variants/2025/10/31/c3d4e5f6.jpg']
   ```

4. **Variant Created:**
   ```sql
   INSERT INTO product_variants (
       id, product_id, name, sku, images, ...
   ) VALUES (
       'uuid-2',
       'uuid-1',
       'Size S',
       'TSH-S',
       '["product-variants/2025/10/31/c3d4e5f6.jpg"]',
       ...
   )
   ```

**Database Result:**
```
products:
  id: uuid-1
  name: T-Shirt
  images: ["products/2025/10/31/a1b2c3d4.jpg", "products/2025/10/31/b2c3d4e5.png"]
  
product_variants:
  id: uuid-2
  product_id: uuid-1
  name: Size S
  images: ["product-variants/2025/10/31/c3d4e5f6.jpg"]
```

---

## Summary

**The upload mechanism is IDENTICAL for both products and variants:**

1. ✅ Check for direct file uploads (`hasFile`)
2. ✅ Upload each file to Supabase with dated path
3. ✅ Store file path in array
4. ✅ Fallback to check form data for mixed input
5. ✅ Handle both new files and existing paths
6. ✅ Save array to JSONB database column

**The ONLY differences are:**
- Path prefix (`products/` vs `product-variants/`)
- Request key (`images` vs `variations.{index}.images`)
- Context logging (variant includes index)

Both use the exact same dual-input pattern and storage strategy.
