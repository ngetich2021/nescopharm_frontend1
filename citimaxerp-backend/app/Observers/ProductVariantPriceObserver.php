<?php

namespace App\Observers;

use App\Models\ProductVariant;
use App\Models\ProductPriceHistory;
use App\Services\ProductPriceHistoryService;

class ProductVariantPriceObserver
{
    protected $priceHistoryService;

    public function __construct(ProductPriceHistoryService $priceHistoryService)
    {
        $this->priceHistoryService = $priceHistoryService;
    }

    /**
     * Handle the ProductVariant "updated" event.
     */
    public function updated(ProductVariant $variant): void
    {
        // Track price changes
        if ($variant->isDirty('price')) {
            $this->priceHistoryService->logVariantPriceChange(
                $variant,
                ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
                $variant->getOriginal('price'),
                $variant->price,
                [
                    'source' => $this->determineSource(),
                ]
            );
        }

        // Track cost changes
        if ($variant->isDirty('cost')) {
            $this->priceHistoryService->logVariantPriceChange(
                $variant,
                ProductPriceHistory::PRICE_TYPE_COST,
                $variant->getOriginal('cost'),
                $variant->cost,
                [
                    'source' => $this->determineSource(),
                ]
            );
        }
    }

    /**
     * Determine the source of the change
     */
    protected function determineSource(): string
    {
        // Check if it's from API request
        if (request()->is('api/*')) {
            return ProductPriceHistory::SOURCE_API;
        }

        // Default to manual update
        return ProductPriceHistory::SOURCE_MANUAL_UPDATE;
    }
}
