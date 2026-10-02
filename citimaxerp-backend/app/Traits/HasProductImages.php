<?php

namespace App\Traits;

use App\Services\ProductImageService;

trait HasProductImages
{
    /**
     * Boot the trait
     */
    protected static function bootHasProductImages()
    {
        // When creating/updating, sync the legacy image_url field if it exists
        static::saving(function ($model) {
            // Only sync image_url if the column exists in the table
            $table = $model->getTable();
            $schema = \Illuminate\Support\Facades\Schema::getConnection()->getDoctrineSchemaManager();
            $columns = array_map('strtolower', array_keys($schema->listTableColumns($table)));
            
            if (in_array('image_url', $columns)) {
                if (isset($model->images) && is_array($model->images) && !empty($model->images)) {
                    $imageService = app(ProductImageService::class);
                    $model->image_url = $imageService->syncLegacyImageUrl($model->images);
                } elseif (empty($model->images)) {
                    $model->image_url = null;
                }
            }
        });
    }

    /**
     * Get public URLs for all images
     * 
     * @return array
     */
    public function getImageUrlsAttribute(): array
    {
        $imageService = app(ProductImageService::class);
        $images = $this->attributes['images'] ?? null;
        
        if (is_string($images)) {
            $images = json_decode($images, true);
        }
        
        return $imageService->getPublicUrls($images) ?? [];
    }

    /**
     * Get primary image public URL
     * 
     * @return string|null
     */
    public function getPrimaryImageUrlAttribute(): ?string
    {
        $imageService = app(ProductImageService::class);
        $images = $this->attributes['images'] ?? null;
        
        if (is_string($images)) {
            $images = json_decode($images, true);
        }
        
        $primaryIndex = $this->attributes['primary_image_index'] ?? 0;
        
        return $imageService->getPrimaryImageUrl($images, $primaryIndex);
    }

    /**
     * Process and store images
     * 
     * @param array $images Array of UploadedFile objects or paths
     * @param string $type 'products' or 'product-variants'
     * @return void
     */
    public function processAndStoreImages(array $images, string $type = 'products')
    {
        $imageService = app(ProductImageService::class);
        $this->images = $imageService->processImages($images, $type);
    }

    /**
     * Delete all associated images from storage
     * 
     * @return array Results of deletion
     */
    public function deleteImages(): array
    {
        $imageService = app(ProductImageService::class);
        $images = $this->attributes['images'] ?? null;
        
        if (is_string($images)) {
            $images = json_decode($images, true);
        }
        
        if (empty($images) || !is_array($images)) {
            return [];
        }
        
        return $imageService->deleteImages($images);
    }
}
