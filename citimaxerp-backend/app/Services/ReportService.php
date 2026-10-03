<?php

namespace App\Services;

use App\Models\CreditNote;
use App\Models\Product;
use App\Models\Order;
use App\Models\Customer;
use App\Models\OrderDispatch;
use App\Models\InventoryMovement;
use App\Models\StockAdjustment;
use App\Models\PurchaseOrder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Builder;

class ReportService
{
    protected ?string $companyId = null;

    public function forCompany(string $companyId): self
    {
        $this->companyId = $companyId;
        return $this;
    }

    /**
     * 1. INVENTORY REPORTS
     */

    /**
     * One row per stock-holding line. A product with sizes yields a parent row (item 164)
     * followed by one row per size (164.1, 164.2, ...), each carrying its own stock and value;
     * the parent row only totals its sizes. Products without sizes yield a single row.
     */
    protected function stockLines(array $filters = []): \Illuminate\Support\Collection
    {
        $query = Product::query()->where('company_id', $this->companyId);
        $this->applyInventoryFilters($query, $filters);

        $products = $query
            ->with(['variants' => function ($q) use ($filters) {
                if (isset($filters['store_id'])) {
                    $q->where('store_id', $filters['store_id']);
                }
            }])
            ->orderBy('item_number')
            ->orderBy('name')
            ->get();

        $batchStats = DB::table('inventory_batches')
            ->where('company_id', $this->companyId)
            ->whereIn('product_id', $products->pluck('id'))
            ->where('quantity_available', '>', 0)
            ->groupBy('product_id', 'variant_id')
            ->select(
                'product_id',
                'variant_id',
                DB::raw('COUNT(*) as batch_count'),
                DB::raw('MIN(expiry_date) as nearest_expiry'),
                DB::raw('SUM(quantity_available * unit_cost) / NULLIF(SUM(quantity_available), 0) as avg_cost')
            )
            ->get()
            ->keyBy(fn ($b) => $b->product_id . '|' . ($b->variant_id ?? ''));

        $line = function (Product $product, $variant, string $itemNo) use ($batchStats) {
            $source = $variant ?? $product;
            $batch = $batchStats->get($product->id . '|' . ($variant->id ?? ''));
            $stock = (int) $source->stock_quantity;
            $allocated = (int) ($source->allocated ?? 0);
            $threshold = (int) ($product->low_stock_threshold ?? 0);

            // Sizes share the parent's price code and usually its cost; fall back through
            // the size's own cost, then what its batches were received at, then the parent.
            $unitCost = (float) ($variant->cost ?? 0);
            if ($unitCost <= 0) $unitCost = (float) ($batch->avg_cost ?? 0);
            if ($unitCost <= 0) $unitCost = (float) ($product->unit_cost ?? 0);

            return [
                'row_type' => $variant ? 'size' : 'item',
                'item_no' => $itemNo,
                'product_id' => $product->id,
                'variant_id' => $variant->id ?? null,
                'parent_item_no' => $variant ? (string) $product->item_number : null,
                'name' => $variant ? \App\Models\ProductVariant::sizedName($product->name, $variant->name) : $product->name,
                'size' => $variant->name ?? null,
                'category' => $product->category,
                'unit' => $product->unit_of_measurement,
                'is_active' => (bool) ($variant ? $variant->is_active : $product->is_active),
                'stock_quantity' => $stock,
                'allocated' => $allocated,
                'available' => max($stock - $allocated, 0),
                'low_stock_threshold' => $threshold,
                'stock_status' => $stock <= 0 ? 'out_of_stock' : ($stock <= $threshold ? 'low_stock' : 'in_stock'),
                'unit_cost' => round($unitCost, 2),
                'stock_value' => round($stock * $unitCost, 2),
                'batch_count' => (int) ($batch->batch_count ?? 0),
                'nearest_expiry' => $batch->nearest_expiry ?? null,
            ];
        };

        $rows = collect();
        foreach ($products as $product) {
            $itemNo = (string) ($product->item_number ?? '');

            if (!$product->has_variations || $product->variants->isEmpty()) {
                $rows->push($line($product, null, $itemNo));
                continue;
            }

            $sizes = $product->variants
                ->filter(fn ($v) => $v->is_active || (int) $v->stock_quantity !== 0)
                ->values()
                ->map(fn ($v, $i) => $line($product, $v, $itemNo . '.' . ($i + 1)));

            $expiries = $sizes->pluck('nearest_expiry')->filter();
            $rows->push([
                'row_type' => 'parent',
                'item_no' => $itemNo,
                'product_id' => $product->id,
                'variant_id' => null,
                'parent_item_no' => null,
                'name' => $product->name,
                'size' => null,
                'size_count' => $sizes->count(),
                'category' => $product->category,
                'unit' => $product->unit_of_measurement,
                'is_active' => (bool) $product->is_active,
                'stock_quantity' => $sizes->sum('stock_quantity'),
                'allocated' => $sizes->sum('allocated'),
                'available' => $sizes->sum('available'),
                'low_stock_threshold' => (int) ($product->low_stock_threshold ?? 0),
                'stock_status' => null,
                'unit_cost' => null,
                'stock_value' => round($sizes->sum('stock_value'), 2),
                'batch_count' => $sizes->sum('batch_count'),
                'nearest_expiry' => $expiries->isEmpty() ? null : $expiries->min(),
            ]);
            $rows = $rows->concat($sizes);
        }

        return $rows->values();
    }

    /**
     * Keeps only the stock lines matching $keep, plus the parent row of any size that matched,
     * so sizes are never shown without the item they belong to.
     */
    protected function filterStockLines(\Illuminate\Support\Collection $rows, callable $keep): \Illuminate\Support\Collection
    {
        $keptNos = $rows->filter(fn ($r) => $r['row_type'] !== 'parent' && $keep($r))->pluck('item_no')->flip();

        return $rows->map(function ($r) use ($rows, $keptNos) {
            if ($r['row_type'] !== 'parent') {
                return $keptNos->has($r['item_no']) ? $r : null;
            }
            $sizes = $rows->filter(fn ($s) => $s['row_type'] === 'size' && $s['product_id'] === $r['product_id'] && $keptNos->has($s['item_no']));
            if ($sizes->isEmpty()) {
                return null;
            }
            foreach (['stock_quantity', 'allocated', 'available', 'batch_count'] as $field) {
                $r[$field] = $sizes->sum($field);
            }
            $r['stock_value'] = round($sizes->sum('stock_value'), 2);
            $r['size_count'] = $sizes->count();
            return $r;
        })->filter()->values();
    }

    protected function stockSummary(\Illuminate\Support\Collection $rows): array
    {
        $lines = $rows->where('row_type', '!=', 'parent');

        return [
            'total_items' => $lines->count(),
            'total_products' => $rows->whereIn('row_type', ['item', 'parent'])->count(),
            'total_stock' => $lines->sum('stock_quantity'),
            'total_allocated' => $lines->sum('allocated'),
            'total_available' => $lines->sum('available'),
            'total_value' => round($lines->sum('stock_value'), 2),
            'low_stock_count' => $lines->where('stock_status', 'low_stock')->count(),
            'out_of_stock_count' => $lines->where('stock_status', 'out_of_stock')->count(),
        ];
    }

    public function getStockBalanceReport(array $filters = []): array
    {
        $rows = $this->stockLines($filters);

        return [
            'data' => $rows->toArray(),
            'summary' => $this->stockSummary($rows),
        ];
    }

    public function getLowStockReport(array $filters = []): array
    {
        $rows = $this->filterStockLines(
            $this->stockLines($filters),
            fn ($r) => in_array($r['stock_status'], ['low_stock', 'out_of_stock'], true)
        );

        return [
            'data' => $rows->toArray(),
            'summary' => $this->stockSummary($rows),
        ];
    }

    /**
     * Opening stock, sales, closing stock, closing-stock value (at buying
     * price) and gross profit per stock line over a period, plus a "months
     * of stock cover" figure (closing stock / average monthly sales) and a
     * reorder flag when that cover drops below 3 months.
     *
     * Lines come from stockLines(): each size is its own line (164.1, 164.2, ...) and the
     * sized item's parent row (164) totals them.
     *
     * Opening stock is derived rather than stored: Opening + Receipts -
     * Sales = Closing, rearranged as Opening = Closing - Receipts + Sales,
     * using the line's current stock_quantity as the closing figure and the
     * inventory-movement ledger for receipts within the period.
     */
    public function getStockManagementReport(array $filters = []): array
    {
        $dateTo = isset($filters['date_to']) ? Carbon::parse($filters['date_to'])->endOfDay() : Carbon::now();
        $dateFrom = isset($filters['date_from']) ? Carbon::parse($filters['date_from'])->startOfDay() : Carbon::now()->startOfMonth();

        // How many months the requested period spans, used to turn the
        // period's total sales into an average monthly sales rate.
        $periodMonths = max($dateFrom->diffInDays($dateTo) / 30, 1 / 30);

        $stockRows = $this->stockLines($filters);
        $productIds = $stockRows->pluck('product_id')->unique()->values();
        $variantIds = $stockRows->pluck('variant_id')->filter()->values();

        $salesByVariant = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled')
            ->whereIn('order_items.variant_id', $variantIds)
            ->whereRaw('COALESCE(orders.order_date, orders.created_at) BETWEEN ? AND ?', [$dateFrom, $dateTo])
            ->groupBy('order_items.variant_id')
            ->select(
                'order_items.variant_id',
                DB::raw('SUM(order_items.quantity) as quantity_sold'),
                DB::raw('SUM(order_items.quantity * order_items.unit_price) as revenue')
            )
            ->get()
            ->keyBy('variant_id');

        // Sales recorded directly against the product with no variant_id -
        // the only case for products without variants, but also possible as
        // an edge case for a variant-bearing product sold without picking a
        // specific variant.
        $salesByProduct = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled')
            ->whereIn('order_items.product_id', $productIds)
            ->whereNull('order_items.variant_id')
            ->whereRaw('COALESCE(orders.order_date, orders.created_at) BETWEEN ? AND ?', [$dateFrom, $dateTo])
            ->groupBy('order_items.product_id')
            ->select(
                'order_items.product_id',
                DB::raw('SUM(order_items.quantity) as quantity_sold'),
                DB::raw('SUM(order_items.quantity * order_items.unit_price) as revenue')
            )
            ->get()
            ->keyBy('product_id');

        $receiptsByVariant = InventoryMovement::query()
            ->where('company_id', $this->companyId)
            ->whereIn('variant_id', $variantIds)
            ->where('type', 'receipt')
            ->whereBetween('movement_date', [$dateFrom, $dateTo])
            ->groupBy('variant_id')
            ->select('variant_id', DB::raw('SUM(quantity) as quantity_received'))
            ->get()
            ->keyBy('variant_id');

        $receiptsByProduct = InventoryMovement::query()
            ->where('company_id', $this->companyId)
            ->whereIn('product_id', $productIds)
            ->whereNull('variant_id')
            ->where('type', 'receipt')
            ->whereBetween('movement_date', [$dateFrom, $dateTo])
            ->groupBy('product_id')
            ->select('product_id', DB::raw('SUM(quantity) as quantity_received'))
            ->get()
            ->keyBy('product_id');

        $withPeriod = function (array $row) use ($salesByVariant, $salesByProduct, $receiptsByVariant, $receiptsByProduct, $periodMonths) {
            $variantId = $row['variant_id'];
            $sales = $variantId ? $salesByVariant->get($variantId) : $salesByProduct->get($row['product_id']);
            $received = $variantId ? $receiptsByVariant->get($variantId) : $receiptsByProduct->get($row['product_id']);
            $quantitySold = (int) ($sales->quantity_sold ?? 0);
            $revenue = (float) ($sales->revenue ?? 0);
            $quantityReceived = (int) ($received->quantity_received ?? 0);
            $closingStock = (int) $row['stock_quantity'];
            $unitCost = (float) $row['unit_cost'];

            $avgMonthlySales = $quantitySold / $periodMonths;
            $monthsOfStock = $avgMonthlySales > 0 ? round($closingStock / $avgMonthlySales, 1) : null;

            return $row + [
                'opening_stock' => $closingStock - $quantityReceived + $quantitySold,
                'stock_received' => $quantityReceived,
                'sales_quantity' => $quantitySold,
                'closing_stock' => $closingStock,
                'closing_stock_value' => round($closingStock * $unitCost, 2),
                'sales_revenue' => round($revenue, 2),
                'gross_profit' => round($revenue - ($quantitySold * $unitCost), 2),
                'avg_monthly_sales' => round($avgMonthlySales, 1),
                'months_of_stock' => $monthsOfStock,
                'needs_reorder' => $avgMonthlySales > 0 && $monthsOfStock < 3,
            ];
        };

        $lines = $stockRows->where('row_type', '!=', 'parent')->map($withPeriod)->keyBy('item_no');

        $items = $stockRows->map(function ($row) use ($lines, $salesByProduct) {
            if ($row['row_type'] !== 'parent') {
                return $lines->get($row['item_no']);
            }
            $sizes = $lines->where('product_id', $row['product_id']);
            // Sales placed on a sized item without choosing a size count towards the item itself.
            $unsized = $salesByProduct->get($row['product_id']);
            $row['opening_stock'] = $sizes->sum('opening_stock') + (int) ($unsized->quantity_sold ?? 0);
            foreach (['stock_received', 'closing_stock'] as $field) {
                $row[$field] = $sizes->sum($field);
            }
            $row['sales_quantity'] = $sizes->sum('sales_quantity') + (int) ($unsized->quantity_sold ?? 0);
            $row['closing_stock_value'] = round($sizes->sum('closing_stock_value'), 2);
            $row['sales_revenue'] = round($sizes->sum('sales_revenue') + (float) ($unsized->revenue ?? 0), 2);
            $row['gross_profit'] = round($sizes->sum('gross_profit') + (float) ($unsized->revenue ?? 0), 2);
            $row['avg_monthly_sales'] = null;
            $row['months_of_stock'] = null;
            $row['needs_reorder'] = $sizes->contains('needs_reorder', true);
            return $row;
        })->values();

        $summaryLines = $items->where('row_type', '!=', 'parent');

        return [
            'data' => $items->toArray(),
            'period' => [
                'date_from' => $dateFrom->toDateString(),
                'date_to' => $dateTo->toDateString(),
                'months' => round($periodMonths, 2),
            ],
            'summary' => [
                'total_items' => $summaryLines->count(),
                'total_closing_stock' => $summaryLines->sum('closing_stock'),
                'total_closing_stock_value' => round($summaryLines->sum('closing_stock_value'), 2),
                'total_sales_quantity' => $summaryLines->sum('sales_quantity'),
                'total_gross_profit' => round($items->whereIn('row_type', ['item', 'parent'])->sum('gross_profit'), 2),
                'reorder_alert_count' => $summaryLines->where('needs_reorder', true)->count(),
            ],
        ];
    }

    public function getInventoryMovementLog(array $filters = []): array
    {
        $query = InventoryMovement::whereHas('product', function ($q) use ($filters) {
            $q->where('company_id', $this->companyId);
            $this->applyInventoryFilters($q, array_diff_key($filters, ['store_id' => true]));
        });

        if (isset($filters['date_from'])) {
            $query->where('movement_date', '>=', Carbon::parse($filters['date_from'])->startOfDay());
        }
        if (isset($filters['date_to'])) {
            $query->where('movement_date', '<=', Carbon::parse($filters['date_to'])->endOfDay());
        }
        if (isset($filters['store_id'])) {
            $query->where('store_id', $filters['store_id']);
        }
        if (isset($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
        }

        $lineNos = $this->stockLines()
            ->where('row_type', '!=', 'parent')
            ->mapWithKeys(fn ($r) => [$r['product_id'] . '|' . ($r['variant_id'] ?? '') => $r]);

        $movements = $query->with(['product:id,name,item_number', 'variant:id,name'])
            ->orderBy('movement_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($m) use ($lineNos) {
                $line = $lineNos->get($m->product_id . '|' . ($m->variant_id ?? ''));
                $inbound = (int) $m->quantity >= 0
                    && !in_array($m->type, ['sale', 'dispatch', 'damage', 'expired', 'adjustment_out', 'transfer_out'], true);
                return [
                    'id' => $m->id,
                    'movement_date' => $m->movement_date ?? $m->created_at,
                    'item_no' => $line['item_no'] ?? (string) ($m->product->item_number ?? ''),
                    'name' => $m->product
                        ? \App\Models\ProductVariant::sizedName($m->product->name, $m->variant?->name)
                        : 'Unknown item',
                    'type' => $m->type,
                    'direction' => $inbound ? 'in' : 'out',
                    'quantity' => abs((int) $m->quantity),
                    'quantity_before' => $m->quantity_before,
                    'quantity_after' => $m->quantity_after,
                    'reference_type' => $m->reference_type ? class_basename($m->reference_type) : null,
                    'reference_number' => $m->reference_number,
                    'unit_cost' => $m->unit_cost !== null ? (float) $m->unit_cost : null,
                    'total_cost' => $m->total_cost !== null ? (float) $m->total_cost : null,
                ];
            });

        return [
            'data' => $movements->values()->toArray(),
            'summary' => [
                'total_movements' => $movements->count(),
                'total_in' => $movements->where('direction', 'in')->sum('quantity'),
                'total_out' => $movements->where('direction', 'out')->sum('quantity'),
            ],
        ];
    }

    /**
     * 2. SALES REPORTS
     */

    public function getSalesPerformanceSummary(array $filters = []): array
    {
        $query = Order::query()->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderFilters($query, $filters);

        $creditNotesQuery = CreditNote::query()
            ->where('company_id', $this->companyId)
            ->whereIn('status', ['issued', 'applied', 'refunded']);

        $this->applyCreditNoteFilters($creditNotesQuery, $filters);
        $creditedRevenue = (float) $creditNotesQuery->sum('total_amount');

        // Summary metrics
        $summary = [
            'total_sales' => (float) $query->sum('orders.final_amount') - $creditedRevenue,
            'total_subtotal' => $query->sum('orders.total_amount'),
            'total_discount' => $query->sum('orders.discount'),
            'total_tax' => $query->sum('orders.tax'),
            'total_credited' => $creditedRevenue,
            'order_count' => $query->count(),
            'average_order_value' => $query->avg('orders.final_amount') ?? 0,
            'total_items_count' => DB::table('order_items')
                ->join('orders', 'order_items.order_id', '=', 'orders.id')
                ->where('orders.company_id', $this->companyId)
                ->where('orders.status', '!=', 'cancelled')
                ->when(isset($filters['date_from']), fn($q) => $q->where('orders.order_date', '>=', $filters['date_from']))
                ->when(isset($filters['date_to']), fn($q) => $q->where('orders.order_date', '<=', $filters['date_to']))
                ->sum('order_items.quantity'),
        ];

        // Summary by date

        $ordersByDate = $query->clone()
            ->select(
                DB::raw('DATE(orders.order_date) as date'),
                DB::raw('SUM(orders.final_amount) as total'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $creditsByDate = CreditNote::query()
            ->where('company_id', $this->companyId)
            ->whereIn('status', ['issued', 'applied', 'refunded']);

        $this->applyCreditNoteFilters($creditsByDate, $filters);

        $creditsByDate = $creditsByDate
            ->select(
                DB::raw('DATE(credit_note_date) as date'),
                DB::raw('SUM(total_amount) as total_credited')
            )
            ->groupBy('date')
            ->pluck('total_credited', 'date');

        // Calculate item counts separately to avoid grouping error
        $itemCountsQuery = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderFilters($itemCountsQuery, $filters);

        $itemCounts = $itemCountsQuery->select(
            DB::raw('DATE(orders.order_date) as date'),
            DB::raw('SUM(order_items.quantity) as count')
        )
            ->groupBy('date')
            ->pluck('count', 'date');

        // Merge results
        $summaryByDate = $ordersByDate->map(function ($orderSummary) use ($itemCounts, $creditsByDate) {
            $data = $orderSummary->toArray();
            $data['item_count'] = $itemCounts[$orderSummary->date] ?? 0;
            $data['credited_total'] = (float) ($creditsByDate[$orderSummary->date] ?? 0);
            $data['net_total'] = (float) $data['total'] - $data['credited_total'];
            return $data;
        })->toArray();

        // Top Categories - build query with all filters
        $topCategoriesQuery = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderFilters($topCategoriesQuery, $filters);

        $topCategories = $topCategoriesQuery
            ->select('products.category', DB::raw('SUM(order_items.quantity * order_items.unit_price) as total_revenue'))
            ->groupBy('products.category')
            ->orderBy('total_revenue', 'desc')
            ->limit(5)
            ->get()->toArray();

        // Top Products - build query with all filters
        $topProductsQuery = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderFilters($topProductsQuery, $filters);

        $topProducts = $topProductsQuery
            ->select('products.name', 'products.sku', DB::raw('SUM(order_items.quantity) as total_quantity'), DB::raw('SUM(order_items.quantity * order_items.unit_price) as total_revenue'))
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderBy('total_revenue', 'desc')
            ->limit(5)
            ->get()->toArray();

        // Top Customers - build query with all filters
        $topCustomersQuery = DB::table('orders')
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->leftJoin('delivery_locations', 'orders.delivery_location_id', '=', 'delivery_locations.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderFilters($topCustomersQuery, $filters);

        $topCustomers = $topCustomersQuery
            ->select(
                DB::raw("CASE WHEN customers.customer_type != 'individual' AND customers.business_name IS NOT NULL THEN customers.business_name ELSE customers.name END as name"),
                DB::raw("COALESCE(delivery_locations.city, customers.city, 'Unknown') as location"),
                DB::raw('COUNT(*) as order_count'),
                DB::raw('SUM(orders.final_amount) as total_spent')
            )
            ->groupBy('customers.id', 'customers.name', 'customers.customer_type', 'customers.business_name', 'delivery_locations.city', 'customers.city')
            ->orderBy('total_spent', 'desc')
            ->limit(5)
            ->get()->toArray();

        // Payment status breakdown - build query with all filters
        $paymentStatusQuery = DB::table('orders')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderFilters($paymentStatusQuery, $filters);

        $paymentStatusBreakdown = $paymentStatusQuery
            ->select('payment_status', DB::raw('COUNT(*) as count'), DB::raw('SUM(final_amount) as total'))
            ->groupBy('payment_status')
            ->get()->toArray();

        return array_merge($summary, [
            'summary_by_date' => $summaryByDate,
            'top_categories' => $topCategories,
            'top_products' => $topProducts,
            'top_customers' => $topCustomers,
            'payment_status_breakdown' => $paymentStatusBreakdown,
        ]);
    }

    public function getProductSalesRanking(array $filters = []): array
    {
        $query = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $this->companyId)
            ->where('orders.status', '!=', 'cancelled');

        if (isset($filters['date_from'])) {
            $query->where('orders.order_date', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $query->where('orders.order_date', '<=', $filters['date_to']);
        }

        return $query->select(
            'products.id',
            'products.name',
            'products.sku',
            DB::raw('SUM(order_items.quantity) as total_quantity'),
            DB::raw('SUM(order_items.quantity * order_items.unit_price) as total_revenue')
        )
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderBy('total_revenue', 'desc')
            ->get()->toArray();
    }

    public function getQuoteConversionReport(array $filters = []): array
    {
        $totalQuotes = DB::table('quotes')->where('company_id', $this->companyId)->count();
        $convertedQuotes = DB::table('quotes')
            ->where('company_id', $this->companyId)
            ->where('status', 'accepted')
            ->count();

        return [
            'total_quotes' => $totalQuotes,
            'converted_quotes' => $convertedQuotes,
            'conversion_rate' => $totalQuotes > 0 ? ($convertedQuotes / $totalQuotes) * 100 : 0
        ];
    }

    /**
     * 3. LOGISTICS REPORTS
     */

    public function getDispatchEfficiencyReport(array $filters = []): array
    {
        $query = OrderDispatch::where('company_id', $this->companyId)
            ->whereNotNull('dispatch_date')
            ->whereNotNull('final_approved_at');

        if (isset($filters['date_from'])) {
            $query->where('dispatch_date', '>=', $filters['date_from']);
        }

        return $query->select(
            'id',
            'dispatch_number',
            'order_id',
            'final_approved_at',
            'dispatch_date',
            DB::raw('EXTRACT(EPOCH FROM (dispatch_date - final_approved_at))/3600 as hours_to_dispatch')
        )->get()->toArray();
    }

    public function getDeliverySuccessRate(array $filters = []): array
    {
        $query = OrderDispatch::where('company_id', $this->companyId);

        return [
            'total_dispatches' => $query->count(),
            'delivered' => $query->where('status', 'delivered')->count(),
            'failed_or_returned' => $query->whereIn('status', ['returned', 'failed'])->count(),
            'pending' => $query->whereIn('status', ['pending', 'in_transit'])->count()
        ];
    }

    /**
     * 4. PROCUREMENT REPORTS
     */

    public function getPurchaseOrderStatusReport(array $filters = []): array
    {
        $query = DB::table('purchase_orders')
            ->leftJoin('purchase_order_items', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_orders.company_id', $this->companyId);

        return $query->select(
            'purchase_orders.status',
            DB::raw('COUNT(DISTINCT purchase_orders.id) as count'),
            DB::raw('COALESCE(SUM(purchase_order_items.subtotal), 0) as total_value')
        )
            ->groupBy('purchase_orders.status')
            ->get()->toArray();
    }

    /**
     * 5. CUSTOMER REPORTS
     */

    public function getCustomerAcquisitionReport(array $filters = []): array
    {
        $query = Customer::query()->where('company_id', $this->companyId);

        if (isset($filters['date_from'])) {
            $query->where('created_at', '>=', $filters['date_from']);
        }

        return $query->select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('COUNT(*) as new_customers')
        )->groupBy('date')->orderBy('date')->get()->toArray();
    }

    /**
     * Helper methods for filters
     */

    protected function applyInventoryFilters(Builder $query, array $filters): void
    {
        if (isset($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        } elseif (isset($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (isset($filters['store_id'])) {
            $query->where('store_id', $filters['store_id']);
        }

        if (isset($filters['status'])) {
            $query->where('is_active', $filters['status'] === 'active' ? 'true' : 'false');
        }

        if (isset($filters['brand'])) {
            $query->where('brand', $filters['brand']);
        }
    }

    protected function applyOrderFilters($query, array $filters): void
    {
        $table = 'orders';

        if (isset($filters['date_from'])) {
            $query->where($table . '.order_date', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $query->where($table . '.order_date', '<=', $filters['date_to']);
        }
        if (isset($filters['customer_id'])) {
            $query->where($table . '.customer_id', $filters['customer_id']);
        }
        if (isset($filters['status'])) {
            $query->where($table . '.status', $filters['status']);
        }
        if (isset($filters['payment_status'])) {
            $query->where($table . '.payment_status', $filters['payment_status']);
        }
        if (isset($filters['location_id'])) {
            $query->where($table . '.delivery_location_id', $filters['location_id']);
        }
        if (isset($filters['city'])) {
            $query->join('delivery_locations', $table . '.delivery_location_id', '=', 'delivery_locations.id')
                ->where('delivery_locations.city', 'ILIKE', '%' . $filters['city'] . '%');
        }
        if (isset($filters['category_id'])) {
            // For queries that join with products table
            $query->where('products.category_id', $filters['category_id']);
        } elseif (isset($filters['category'])) {
            // For queries that join with products table
            $query->where('products.category', $filters['category']);
        }
    }

    protected function applyCreditNoteFilters($query, array $filters): void
    {
        if (isset($filters['date_from'])) {
            $query->where('credit_note_date', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $query->where('credit_note_date', '<=', $filters['date_to']);
        }
        if (isset($filters['customer_id'])) {
            $query->where('customer_id', $filters['customer_id']);
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
    }
}
