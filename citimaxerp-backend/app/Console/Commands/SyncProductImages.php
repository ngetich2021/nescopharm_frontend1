<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\ProductImageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncProductImages extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'products:sync-images 
                            {--type=all : Type to sync (all, products, variants)}
                            {--dry-run : Run without making changes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync product and variant images to standardized format';

    protected ProductImageService $imageService;

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->imageService = app(ProductImageService::class);
        $type = $this->option('type');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('Running in DRY RUN mode - no changes will be made');
        }

        $this->info('Starting image synchronization...');

        if ($type === 'all' || $type === 'products') {
            $this->syncProducts($dryRun);
        }

        if ($type === 'all' || $type === 'variants') {
            $this->syncVariants($dryRun);
        }

        $this->info('Image synchronization complete!');
    }

    /**
     * Sync product images
     */
    protected function syncProducts(bool $dryRun)
    {
        $this->info('Syncing product images...');

        $bar = $this->output->createProgressBar();
        $updated = 0;
        $skipped = 0;
        $errors = 0;

        Product::chunk(100, function ($products) use ($dryRun, &$updated, &$skipped, &$errors, $bar) {
            foreach ($products as $product) {
                $bar->advance();
                
                try {
                    $changed = false;

                    // Case 1: Has image_url but no images array - convert URL to path
                    if (!empty($product->image_url) && empty($product->images)) {
                        $path = $this->imageService->normalizeImagePath($product->image_url);
                        
                        if (!$dryRun) {
                            $product->images = [$path];
                            $product->save();
                        }
                        
                        $changed = true;
                        $this->line("\n  Product {$product->id}: Converted image_url to images array");
                    }
                    
                    // Case 2: Has images with URLs instead of paths - normalize them
                    elseif (!empty($product->images) && is_array($product->images)) {
                        $normalized = array_map(
                            fn($img) => $this->imageService->normalizeImagePath($img),
                            $product->images
                        );
                        
                        // Check if any changed
                        if ($normalized !== $product->images) {
                            if (!$dryRun) {
                                $product->images = $normalized;
                                $product->save();
                            }
                            
                            $changed = true;
                            $this->line("\n  Product {$product->id}: Normalized image paths");
                        }
                    }

                    if ($changed) {
                        $updated++;
                    } else {
                        $skipped++;
                    }

                } catch (\Exception $e) {
                    $errors++;
                    $this->error("\n  Error syncing product {$product->id}: " . $e->getMessage());
                }
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->table(
            ['Status', 'Count'],
            [
                ['Updated', $updated],
                ['Skipped', $skipped],
                ['Errors', $errors],
            ]
        );
    }

    /**
     * Sync variant images
     */
    protected function syncVariants(bool $dryRun)
    {
        $this->info('Syncing product variant images...');

        $bar = $this->output->createProgressBar();
        $updated = 0;
        $skipped = 0;
        $errors = 0;

        ProductVariant::chunk(100, function ($variants) use ($dryRun, &$updated, &$skipped, &$errors, $bar) {
            foreach ($variants as $variant) {
                $bar->advance();
                
                try {
                    $changed = false;

                    // Case 1: Has images with URLs instead of paths - normalize them
                    if (!empty($variant->images) && is_array($variant->images)) {
                        $normalized = array_map(
                            fn($img) => $this->imageService->normalizeImagePath($img),
                            $variant->images
                        );
                        
                        // Check if any changed
                        if ($normalized !== $variant->images) {
                            if (!$dryRun) {
                                $variant->images = $normalized;
                                $variant->save();
                            }
                            
                            $changed = true;
                            $this->line("\n  Variant {$variant->id}: Normalized image paths");
                        }
                    }
                    
                    // Case 2: Sync image_url if field exists (after migration)
                    if (DB::getSchemaBuilder()->hasColumn('product_variants', 'image_url')) {
                        if (!empty($variant->images) && is_array($variant->images)) {
                            $expectedUrl = $this->imageService->syncLegacyImageUrl($variant->images);
                            
                            if ($variant->image_url !== $expectedUrl) {
                                if (!$dryRun) {
                                    $variant->image_url = $expectedUrl;
                                    $variant->save();
                                }
                                
                                $changed = true;
                                $this->line("\n  Variant {$variant->id}: Synced image_url field");
                            }
                        }
                    }

                    if ($changed) {
                        $updated++;
                    } else {
                        $skipped++;
                    }

                } catch (\Exception $e) {
                    $errors++;
                    $this->error("\n  Error syncing variant {$variant->id}: " . $e->getMessage());
                }
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->table(
            ['Status', 'Count'],
            [
                ['Updated', $updated],
                ['Skipped', $skipped],
                ['Errors', $errors],
            ]
        );
    }
}
