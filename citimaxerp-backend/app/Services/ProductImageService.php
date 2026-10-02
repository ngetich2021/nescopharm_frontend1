<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImageService
{
    protected string $disk;

    public function __construct()
    {
        $this->disk = config('filesystems.default', 's3');
    }

    /**
     * Upload product images and return array of file paths
     * 
     * @param array $images Array of UploadedFile objects or existing paths
     * @param string $type 'products' or 'product-variants'
     * @return array Array of file paths
     */
    public function processImages(array $images, string $type = 'products'): array
    {
        $processedImages = [];

        foreach ($images as $image) {
            if ($image instanceof UploadedFile) {
                // Upload new file
                $path = $this->generateImagePath($type, $image->getClientOriginalExtension());

                try {
                    $storedPath = Storage::disk($this->disk)->putFileAs(
                        dirname($path),
                        $image,
                        basename($path)
                    );

                    if ($storedPath) {
                        $processedImages[] = $storedPath;
                    } else {
                        throw new \Exception("Failed to store file on disk {$this->disk}");
                    }
                } catch (\Exception $e) {
                    Log::error("Storage upload failed for {$type} image", [
                        'error' => $e->getMessage(),
                        'file' => $image->getClientOriginalName()
                    ]);
                }
            } elseif (is_string($image) && !empty($image)) {
                // Reject blob URLs - these are browser-generated temporary URLs
                if (str_starts_with($image, 'blob:')) {
                    Log::warning('Blob URL rejected - frontend must send File objects, not blob URLs', [
                        'blob_url' => $image,
                        'type' => $type
                    ]);
                    continue; // Skip this image
                }

                // Base64 data URI (e.g. "data:image/png;base64,....") - decode and store as a new file
                if (preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/', $image, $matches)) {
                    $storedPath = $this->storeBase64Image($matches[1], $matches[2], $type);
                    if ($storedPath) {
                        $processedImages[] = $storedPath;
                    }
                    continue;
                }

                // Keep existing path or URL
                // Normalize to path format if it's a full URL
                $processedImages[] = $this->normalizeImagePath($image);
            }
        }

        return $processedImages;
    }

    /**
     * Decode and store a base64-encoded image, returning its storage path (or null on failure).
     */
    protected function storeBase64Image(string $mimeType, string $base64Data, string $type): ?string
    {
        $extensionMap = [
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
        ];
        $extension = $extensionMap[$mimeType] ?? 'jpg';

        $binary = base64_decode($base64Data, true);
        if ($binary === false) {
            Log::warning('Failed to decode base64 image', ['type' => $type]);
            return null;
        }

        $path = $this->generateImagePath($type, $extension);

        try {
            $stored = Storage::disk($this->disk)->put($path, $binary);
            return $stored ? $path : null;
        } catch (\Exception $e) {
            Log::error("Storage upload failed for {$type} base64 image", ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Generate standardized image path
     * 
     * @param string $type 'products' or 'product-variants'
     * @param string $extension File extension
     * @return string Generated path
     */
    protected function generateImagePath(string $type, string $extension): string
    {
        return "{$type}/" . date('Y/m/d') . '/' . Str::uuid() . '.' . $extension;
    }

    /**
     * Normalize image path/URL to standard path format
     * Converts full storage URLs to relative paths
     * 
     * @param string $imagePathOrUrl
     * @return string Normalized path
     */
    public function normalizeImagePath(string $imagePathOrUrl): string
    {
        // If it's already a relative path, return as is
        if (!str_contains($imagePathOrUrl, 'http://') && !str_contains($imagePathOrUrl, 'https://')) {
            return $imagePathOrUrl;
        }

        // Extract path from Storage URL
        // If it matches the S3 URL pattern
        $pattern = '/\.s3\.[^\/]+\.amazonaws\.com\/(.+)$/';
        if (preg_match($pattern, $imagePathOrUrl, $matches)) {
            return $matches[1];
        }

        // If it matches the Supabase URL pattern (fallback for legacy data)
        $pattern = '/storage\/v1\/object\/public\/[^\/]+\/(.+)$/';
        if (preg_match($pattern, $imagePathOrUrl, $matches)) {
            return $matches[1];
        }

        // If pattern doesn't match, log warning and return as is
        Log::warning('Could not normalize image path', ['path' => $imagePathOrUrl]);
        return $imagePathOrUrl;
    }

    public function getPublicUrls($paths)
    {
        if (is_null($paths)) {
            return null;
        }

        if (is_string($paths)) {
            return $this->getUrl($paths);
        }

        if (is_array($paths)) {
            return array_map(function ($path) {
                return $this->getUrl($path);
            }, $paths);
        }

        return null;
    }

    /**
     * Get URL for a single path, using signed URLs for cloud storage
     * 
     * @param string $path
     * @return string
     */
    protected function getUrl(string $path): string
    {
        // For cloud storage (S3/R2), use signed URLs by default if bucket might be private
        if ($this->disk === 's3' || config("filesystems.disks.{$this->disk}.driver") === 's3') {
            try {
                return Storage::disk($this->disk)->temporaryUrl(
                    $path,
                    now()->addHours(24) // 24 hour expiration
                );
            } catch (\Exception $e) {
                // Fallback to public URL if temporaryUrl is not supported
                return Storage::disk($this->disk)->url($path);
            }
        }

        return Storage::disk($this->disk)->url($path);
    }

    public function getPrimaryImageUrl(?array $images, int $primaryIndex = 0): ?string
    {
        if (empty($images) || !is_array($images)) {
            return null;
        }

        $index = min($primaryIndex, count($images) - 1);
        $index = max(0, $index);

        return $this->getUrl($images[$index]);
    }

    /**
     * Delete images from storage
     * 
     * @param array $imagePaths Array of file paths to delete
     * @return array Results of deletion attempts
     */
    public function deleteImages(array $imagePaths): array
    {
        $results = [];

        foreach ($imagePaths as $path) {
            if (empty($path)) {
                continue;
            }

            // Normalize path before deletion
            $normalizedPath = $this->normalizeImagePath($path);

            try {
                $success = Storage::disk($this->disk)->delete($normalizedPath);
                $results[] = [
                    'path' => $path,
                    'success' => $success,
                    'error' => $success ? null : 'Failed to delete file'
                ];
            } catch (\Exception $e) {
                $results[] = [
                    'path' => $path,
                    'success' => false,
                    'error' => $e->getMessage()
                ];
            }
        }

        return $results;
    }

    public function syncLegacyImageUrl(?array $images): ?string
    {
        if (empty($images) || !is_array($images)) {
            return null;
        }

        // Return URL of first image
        return $this->getUrl($images[0]);
    }

    /**
     * Validate image file
     * 
     * @param UploadedFile $file
     * @param int $maxSizeKb Maximum file size in KB (default 5MB)
     * @param array $allowedMimes Allowed mime types
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validateImage(
        UploadedFile $file,
        int $maxSizeKb = 5120,
        array $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    ): array {
        // Check file size
        if ($file->getSize() > ($maxSizeKb * 1024)) {
            return [
                'valid' => false,
                'error' => "Image exceeds maximum size of {$maxSizeKb}KB"
            ];
        }

        // Check mime type
        if (!in_array($file->getMimeType(), $allowedMimes)) {
            return [
                'valid' => false,
                'error' => 'Invalid image type. Allowed: ' . implode(', ', $allowedMimes)
            ];
        }

        return ['valid' => true, 'error' => null];
    }
}
