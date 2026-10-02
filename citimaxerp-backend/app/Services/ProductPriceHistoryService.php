<?php

namespace App\Services;

use App\Models\ProductPriceHistory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductPackagingUnit;
use App\Models\ProductReceiptItem;
use Illuminate\Support\Str;

class ProductPriceHistoryService
{
    /**
     * Log a price change for a product
     *
     * @param Product $product
     * @param string $priceType
     * @param float|null $oldValue
     * @param float|null $newValue
     * @param array $options
     * @return ProductPriceHistory|null
     */
    public function logProductPriceChange(
        Product $product,
        string $priceType,
        $oldValue,
        $newValue,
        array $options = []
    ) {
        // Don't log if values are the same
        if ($oldValue == $newValue) {
            return null;
        }

        return $this->createPriceHistory([
            'company_id' => $product->company_id,
            'product_id' => $product->id,
            'price_type' => $priceType,
            'old_value' => $oldValue,
            'new_value' => $newValue,
        ], $options);
    }

    /**
     * Log a price change for a product variant
     *
     * @param ProductVariant $variant
     * @param string $priceType
     * @param float|null $oldValue
     * @param float|null $newValue
     * @param array $options
     * @return ProductPriceHistory|null
     */
    public function logVariantPriceChange(
        ProductVariant $variant,
        string $priceType,
        $oldValue,
        $newValue,
        array $options = []
    ) {
        // Don't log if values are the same
        if ($oldValue == $newValue) {
            return null;
        }

        return $this->createPriceHistory([
            'company_id' => $variant->company_id,
            'product_id' => $variant->product_id,
            'variant_id' => $variant->id,
            'price_type' => $priceType,
            'old_value' => $oldValue,
            'new_value' => $newValue,
        ], $options);
    }

    /**
     * Log a price change for a packaging unit
     *
     * @param ProductPackagingUnit $packagingUnit
     * @param string $priceType
     * @param float|null $oldValue
     * @param float|null $newValue
     * @param array $options
     * @return ProductPriceHistory|null
     */
    public function logPackagingUnitPriceChange(
        ProductPackagingUnit $packagingUnit,
        string $priceType,
        $oldValue,
        $newValue,
        array $options = []
    ) {
        // Don't log if values are the same
        if ($oldValue == $newValue) {
            return null;
        }

        return $this->createPriceHistory([
            'company_id' => $packagingUnit->company_id,
            'product_id' => $packagingUnit->product_id,
            'packaging_unit_id' => $packagingUnit->id,
            'price_type' => $priceType,
            'old_value' => $oldValue,
            'new_value' => $newValue,
        ], $options);
    }

    /**
     * Log a price change from a receipt item
     *
     * @param ProductReceiptItem $receiptItem
     * @param float|null $newUnitPrice
     * @param array $options
     * @return ProductPriceHistory|null
     */
    public function logReceiptItemPriceChange(
        ProductReceiptItem $receiptItem,
        $newUnitPrice,
        array $options = []
    ) {
        $oldValue = $receiptItem->getOriginal('unit_price');
        
        // Don't log if values are the same
        if ($oldValue == $newUnitPrice) {
            return null;
        }

        return $this->createPriceHistory([
            'company_id' => $receiptItem->company_id,
            'product_id' => $receiptItem->product_id,
            'variant_id' => $receiptItem->variant_id,
            'receipt_item_id' => $receiptItem->id,
            'price_type' => ProductPriceHistory::PRICE_TYPE_UNIT_PRICE,
            'old_value' => $oldValue,
            'new_value' => $newUnitPrice,
        ], array_merge($options, [
            'source' => ProductPriceHistory::SOURCE_RECEIPT,
        ]));
    }

    /**
     * Create a price history record
     *
     * @param array $data
     * @param array $options
     * @return ProductPriceHistory
     */
    protected function createPriceHistory(array $data, array $options = [])
    {
        // Calculate change amount and percentage
        $changeAmount = null;
        $changePercentage = null;
        
        if ($data['old_value'] !== null && $data['new_value'] !== null) {
            $changeAmount = $data['new_value'] - $data['old_value'];
            
            if ($data['old_value'] != 0) {
                $changePercentage = ($changeAmount / $data['old_value']) * 100;
            }
        }

        $historyData = array_merge([
            'id' => Str::uuid(),
            'change_amount' => $changeAmount,
            'change_percentage' => $changePercentage,
            'changed_by' => auth()->id(),
            'source' => ProductPriceHistory::SOURCE_MANUAL_UPDATE,
            'created_at' => now(),
        ], $data, $options);

        return ProductPriceHistory::create($historyData);
    }

    /**
     * Get price history for a product
     *
     * @param Product $product
     * @param array $filters
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getProductPriceHistory(Product $product, array $filters = [])
    {
        $query = ProductPriceHistory::where('product_id', $product->id)
            ->whereNull('variant_id')
            ->whereNull('packaging_unit_id')
            ->orderBy('created_at', 'desc');

        return $this->applyFilters($query, $filters)->get();
    }

    /**
     * Get price history for a variant
     *
     * @param ProductVariant $variant
     * @param array $filters
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getVariantPriceHistory(ProductVariant $variant, array $filters = [])
    {
        $query = ProductPriceHistory::where('variant_id', $variant->id)
            ->orderBy('created_at', 'desc');

        return $this->applyFilters($query, $filters)->get();
    }

    /**
     * Get price history for a packaging unit
     *
     * @param ProductPackagingUnit $packagingUnit
     * @param array $filters
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getPackagingUnitPriceHistory(ProductPackagingUnit $packagingUnit, array $filters = [])
    {
        $query = ProductPriceHistory::where('packaging_unit_id', $packagingUnit->id)
            ->orderBy('created_at', 'desc');

        return $this->applyFilters($query, $filters)->get();
    }

    /**
     * Get all price changes for a company within a date range
     *
     * @param string $companyId
     * @param \DateTime|null $startDate
     * @param \DateTime|null $endDate
     * @param array $filters
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getCompanyPriceChanges(
        string $companyId,
        $startDate = null,
        $endDate = null,
        array $filters = []
    ) {
        $query = ProductPriceHistory::where('company_id', $companyId)
            ->with(['product', 'variant', 'packagingUnit', 'changedBy'])
            ->orderBy('created_at', 'desc');

        if ($startDate) {
            $query->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('created_at', '<=', $endDate);
        }

        return $this->applyFilters($query, $filters)->get();
    }

    /**
     * Get price changes summary statistics
     *
     * @param string $companyId
     * @param int $days
     * @return array
     */
    public function getPriceChangesSummary(string $companyId, int $days = 30)
    {
        $startDate = now()->subDays($days);

        $totalChanges = ProductPriceHistory::where('company_id', $companyId)
            ->where('created_at', '>=', $startDate)
            ->count();

        $priceIncreases = ProductPriceHistory::where('company_id', $companyId)
            ->where('created_at', '>=', $startDate)
            ->priceIncreases()
            ->count();

        $priceDecreases = ProductPriceHistory::where('company_id', $companyId)
            ->where('created_at', '>=', $startDate)
            ->priceDecreases()
            ->count();

        $averageChange = ProductPriceHistory::where('company_id', $companyId)
            ->where('created_at', '>=', $startDate)
            ->whereNotNull('change_percentage')
            ->avg('change_percentage');

        $changesByType = ProductPriceHistory::where('company_id', $companyId)
            ->where('created_at', '>=', $startDate)
            ->selectRaw('price_type, count(*) as count')
            ->groupBy('price_type')
            ->pluck('count', 'price_type')
            ->toArray();

        return [
            'period_days' => $days,
            'total_changes' => $totalChanges,
            'price_increases' => $priceIncreases,
            'price_decreases' => $priceDecreases,
            'average_change_percentage' => round($averageChange ?? 0, 2),
            'changes_by_type' => $changesByType,
        ];
    }

    /**
     * Apply filters to a query
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param array $filters
     * @return \Illuminate\Database\Eloquent\Builder
     */
    protected function applyFilters($query, array $filters)
    {
        if (isset($filters['price_type'])) {
            $query->where('price_type', $filters['price_type']);
        }

        if (isset($filters['source'])) {
            $query->where('source', $filters['source']);
        }

        if (isset($filters['start_date'])) {
            $query->where('created_at', '>=', $filters['start_date']);
        }

        if (isset($filters['end_date'])) {
            $query->where('created_at', '<=', $filters['end_date']);
        }

        if (isset($filters['increases_only']) && $filters['increases_only']) {
            $query->priceIncreases();
        }

        if (isset($filters['decreases_only']) && $filters['decreases_only']) {
            $query->priceDecreases();
        }

        return $query;
    }

    /**
     * Bulk log price changes from array
     *
     * @param array $changes Array of change data
     * @param array $defaultOptions Default options for all changes
     * @return int Number of records created
     */
    public function bulkLogPriceChanges(array $changes, array $defaultOptions = [])
    {
        $records = [];
        
        foreach ($changes as $change) {
            if (!isset($change['old_value'], $change['new_value']) || $change['old_value'] == $change['new_value']) {
                continue;
            }

            $changeAmount = $change['new_value'] - $change['old_value'];
            $changePercentage = null;
            
            if ($change['old_value'] != 0) {
                $changePercentage = ($changeAmount / $change['old_value']) * 100;
            }

            $records[] = array_merge([
                'id' => Str::uuid(),
                'change_amount' => $changeAmount,
                'change_percentage' => $changePercentage,
                'changed_by' => auth()->id(),
                'source' => ProductPriceHistory::SOURCE_BULK_IMPORT,
                'created_at' => now(),
            ], $change, $defaultOptions);
        }

        if (empty($records)) {
            return 0;
        }

        ProductPriceHistory::insert($records);
        
        return count($records);
    }
}
