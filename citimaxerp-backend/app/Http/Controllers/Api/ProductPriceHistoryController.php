<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductPackagingUnit;
use App\Services\ProductPriceHistoryService;
use Illuminate\Http\Request;

class ProductPriceHistoryController extends Controller
{
    protected $priceHistoryService;

    public function __construct(ProductPriceHistoryService $priceHistoryService)
    {
        $this->priceHistoryService = $priceHistoryService;
    }

    /**
     * Get price history for a product
     * GET /api/products/{id}/price-history
     */
    public function getProductPriceHistory(Request $request, $productId)
    {
        $product = Product::findOrFail($productId);

        // Check authorization
        if ($product->company_id !== auth()->user()->company_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $filters = [
            'price_type' => $request->input('price_type'),
            'source' => $request->input('source'),
            'increases_only' => $request->boolean('increases_only'),
            'decreases_only' => $request->boolean('decreases_only'),
        ];

        if ($request->has('days')) {
            $filters['start_date'] = now()->subDays($request->input('days'));
        }

        if ($request->has('start_date')) {
            $filters['start_date'] = $request->input('start_date');
        }

        if ($request->has('end_date')) {
            $filters['end_date'] = $request->input('end_date');
        }

        $history = $this->priceHistoryService->getProductPriceHistory($product, $filters);

        return response()->json([
            'success' => true,
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'product_number' => $product->product_number,
            ],
            'history' => $history->map(function ($item) {
                return [
                    'id' => $item->id,
                    'price_type' => $item->price_type,
                    'price_type_label' => $item->getPriceTypeLabel(),
                    'old_value' => $item->old_value,
                    'new_value' => $item->new_value,
                    'change_amount' => $item->change_amount,
                    'change_percentage' => $item->change_percentage,
                    'formatted_change' => $item->getFormattedChange(),
                    'formatted_percentage' => $item->getFormattedPercentageChange(),
                    'is_increase' => $item->isPriceIncrease(),
                    'is_decrease' => $item->isPriceDecrease(),
                    'changed_by' => $item->changedBy ? [
                        'id' => $item->changedBy->id,
                        'name' => $item->changedBy->name,
                    ] : null,
                    'change_reason' => $item->change_reason,
                    'source' => $item->source,
                    'source_reference' => $item->source_reference,
                    'metadata' => $item->metadata,
                    'created_at' => $item->created_at,
                ];
            }),
            'count' => $history->count(),
        ]);
    }

    /**
     * Get all price history for a product (including variants and packaging units)
     * GET /api/products/{id}/price-history/all
     */
    public function getAllProductPriceHistory(Request $request, $productId)
    {
        $product = Product::findOrFail($productId);

        // Check authorization
        if ($product->company_id !== auth()->user()->company_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = $product->allPriceHistory()
            ->with(['variant', 'packagingUnit', 'changedBy']);

        if ($request->has('days')) {
            $query->where('created_at', '>=', now()->subDays($request->input('days')));
        }

        if ($request->has('price_type')) {
            $query->where('price_type', $request->input('price_type'));
        }

        $history = $query->get();

        return response()->json([
            'success' => true,
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'product_number' => $product->product_number,
            ],
            'history' => $history->map(function ($item) {
                return [
                    'id' => $item->id,
                    'entity_type' => $item->getEntityTypeName(),
                    'entity' => $item->variant ? [
                        'type' => 'variant',
                        'id' => $item->variant->id,
                        'name' => $item->variant->name,
                    ] : ($item->packagingUnit ? [
                        'type' => 'packaging_unit',
                        'id' => $item->packagingUnit->id,
                        'name' => $item->packagingUnit->unit_name,
                    ] : [
                        'type' => 'product',
                        'id' => $item->product_id,
                    ]),
                    'price_type' => $item->price_type,
                    'price_type_label' => $item->getPriceTypeLabel(),
                    'old_value' => $item->old_value,
                    'new_value' => $item->new_value,
                    'change_amount' => $item->change_amount,
                    'change_percentage' => $item->change_percentage,
                    'formatted_change' => $item->getFormattedChange(),
                    'formatted_percentage' => $item->getFormattedPercentageChange(),
                    'is_increase' => $item->isPriceIncrease(),
                    'changed_by' => $item->changedBy ? [
                        'id' => $item->changedBy->id,
                        'name' => $item->changedBy->name,
                    ] : null,
                    'source' => $item->source,
                    'created_at' => $item->created_at,
                ];
            }),
            'count' => $history->count(),
        ]);
    }

    /**
     * Get price history for a variant
     * GET /api/variants/{id}/price-history
     */
    public function getVariantPriceHistory(Request $request, $variantId)
    {
        $variant = ProductVariant::with('product')->findOrFail($variantId);

        // Check authorization
        if ($variant->company_id !== auth()->user()->company_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $filters = [];
        if ($request->has('days')) {
            $filters['start_date'] = now()->subDays($request->input('days'));
        }

        $history = $this->priceHistoryService->getVariantPriceHistory($variant, $filters);

        return response()->json([
            'success' => true,
            'variant' => [
                'id' => $variant->id,
                'name' => $variant->name,
                'product' => [
                    'id' => $variant->product->id,
                    'name' => $variant->product->name,
                ],
            ],
            'history' => $history,
            'count' => $history->count(),
        ]);
    }

    /**
     * Get price history for a packaging unit
     * GET /api/packaging-units/{id}/price-history
     */
    public function getPackagingUnitPriceHistory(Request $request, $packagingUnitId)
    {
        $packagingUnit = ProductPackagingUnit::with('product')->findOrFail($packagingUnitId);

        // Check authorization
        if ($packagingUnit->company_id !== auth()->user()->company_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $filters = [];
        if ($request->has('days')) {
            $filters['start_date'] = now()->subDays($request->input('days'));
        }

        $history = $this->priceHistoryService->getPackagingUnitPriceHistory($packagingUnit, $filters);

        return response()->json([
            'success' => true,
            'packaging_unit' => [
                'id' => $packagingUnit->id,
                'unit_name' => $packagingUnit->unit_name,
                'product' => [
                    'id' => $packagingUnit->product->id,
                    'name' => $packagingUnit->product->name,
                ],
            ],
            'history' => $history,
            'count' => $history->count(),
        ]);
    }

    /**
     * Get company-wide price changes
     * GET /api/companies/{id}/price-changes
     */
    public function getCompanyPriceChanges(Request $request, $companyId)
    {
        // Check authorization
        if ($companyId !== auth()->user()->company_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $startDate = $request->has('start_date') 
            ? \Carbon\Carbon::parse($request->input('start_date'))
            : now()->subDays(30);

        $endDate = $request->has('end_date')
            ? \Carbon\Carbon::parse($request->input('end_date'))
            : now();

        $filters = [
            'price_type' => $request->input('price_type'),
            'source' => $request->input('source'),
        ];

        $priceChanges = $this->priceHistoryService->getCompanyPriceChanges(
            $companyId,
            $startDate,
            $endDate,
            $filters
        );

        return response()->json([
            'success' => true,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'price_changes' => $priceChanges->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product' => $item->product ? [
                        'id' => $item->product->id,
                        'name' => $item->product->name,
                        'product_number' => $item->product->product_number,
                    ] : null,
                    'variant' => $item->variant ? [
                        'id' => $item->variant->id,
                        'name' => $item->variant->name,
                    ] : null,
                    'packaging_unit' => $item->packagingUnit ? [
                        'id' => $item->packagingUnit->id,
                        'unit_name' => $item->packagingUnit->unit_name,
                    ] : null,
                    'entity_type' => $item->getEntityTypeName(),
                    'price_type' => $item->price_type,
                    'price_type_label' => $item->getPriceTypeLabel(),
                    'old_value' => $item->old_value,
                    'new_value' => $item->new_value,
                    'change_amount' => $item->change_amount,
                    'change_percentage' => $item->change_percentage,
                    'formatted_change' => $item->getFormattedChange(),
                    'formatted_percentage' => $item->getFormattedPercentageChange(),
                    'is_increase' => $item->isPriceIncrease(),
                    'changed_by' => $item->changedBy ? [
                        'id' => $item->changedBy->id,
                        'name' => $item->changedBy->name,
                    ] : null,
                    'source' => $item->source,
                    'source_reference' => $item->source_reference,
                    'created_at' => $item->created_at,
                ];
            }),
            'count' => $priceChanges->count(),
        ]);
    }

    /**
     * Get price changes summary statistics
     * GET /api/companies/{id}/price-changes/summary
     */
    public function getPriceChangesSummary(Request $request, $companyId)
    {
        // Check authorization
        if ($companyId !== auth()->user()->company_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $days = $request->input('days', 30);
        
        $summary = $this->priceHistoryService->getPriceChangesSummary($companyId, $days);

        return response()->json([
            'success' => true,
            'summary' => $summary,
        ]);
    }
}
