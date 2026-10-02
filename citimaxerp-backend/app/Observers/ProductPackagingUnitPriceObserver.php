<?php

namespace App\Observers;

use App\Models\ProductPackagingUnit;
use App\Models\ProductPriceHistory;
use App\Services\ProductPriceHistoryService;

class ProductPackagingUnitPriceObserver
{
    protected $priceHistoryService;

    public function __construct(ProductPriceHistoryService $priceHistoryService)
    {
        $this->priceHistoryService = $priceHistoryService;
    }

    /**
     * Handle the ProductPackagingUnit "updated" event.
     */
    public function updated(ProductPackagingUnit $packagingUnit): void
    {
        // Track price_per_unit changes
        if ($packagingUnit->isDirty('price_per_unit')) {
            $this->priceHistoryService->logPackagingUnitPriceChange(
                $packagingUnit,
                ProductPriceHistory::PRICE_TYPE_PRICE_PER_UNIT,
                $packagingUnit->getOriginal('price_per_unit'),
                $packagingUnit->price_per_unit,
                [
                    'source' => $this->determineSource(),
                    'metadata' => [
                        'unit_name' => $packagingUnit->unit_name,
                        'unit_abbreviation' => $packagingUnit->unit_abbreviation,
                    ],
                ]
            );
        }

        // Track cost_per_unit changes
        if ($packagingUnit->isDirty('cost_per_unit')) {
            $this->priceHistoryService->logPackagingUnitPriceChange(
                $packagingUnit,
                ProductPriceHistory::PRICE_TYPE_COST_PER_UNIT,
                $packagingUnit->getOriginal('cost_per_unit'),
                $packagingUnit->cost_per_unit,
                [
                    'source' => $this->determineSource(),
                    'metadata' => [
                        'unit_name' => $packagingUnit->unit_name,
                        'unit_abbreviation' => $packagingUnit->unit_abbreviation,
                    ],
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
