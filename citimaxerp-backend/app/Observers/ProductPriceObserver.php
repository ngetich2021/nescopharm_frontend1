<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\ProductPriceHistory;
use App\Services\ProductPriceHistoryService;

class ProductPriceObserver
{
    protected $priceHistoryService;

    public function __construct(ProductPriceHistoryService $priceHistoryService)
    {
        $this->priceHistoryService = $priceHistoryService;
    }

    /**
     * Handle the Product "updated" event.
     */
    public function updated(Product $product): void
    {
        // Track price changes
        if ($product->isDirty('price')) {
            $this->priceHistoryService->logProductPriceChange(
                $product,
                ProductPriceHistory::PRICE_TYPE_SELLING_PRICE,
                $product->getOriginal('price'),
                $product->price,
                [
                    'source' => $this->determineSource(),
                ]
            );
        }

        // Track unit_cost changes
        if ($product->isDirty('unit_cost')) {
            $this->priceHistoryService->logProductPriceChange(
                $product,
                ProductPriceHistory::PRICE_TYPE_UNIT_COST,
                $product->getOriginal('unit_cost'),
                $product->unit_cost,
                [
                    'source' => $this->determineSource(),
                ]
            );
        }

        // Track last_price changes
        if ($product->isDirty('last_price')) {
            $this->priceHistoryService->logProductPriceChange(
                $product,
                ProductPriceHistory::PRICE_TYPE_LAST_PRICE,
                $product->getOriginal('last_price'),
                $product->last_price,
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
