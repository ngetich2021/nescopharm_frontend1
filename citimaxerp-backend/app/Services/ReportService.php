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
     * Opening stock is derived rather than stored: Opening + Received + Returns/Adj. - Sold = Closing,
     * rearranged as Opening = Closing - Received - Returns/Adj. + Sold. Closing is the stock at the end of
     * the "To" date: today's stock, less what came in after that date, plus what was sold after it.
     * Received and Returns/Adj. come from the inventory-movement ledger, Sold from the orders.
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

        // An item sold by a packaging unit stores the number of packs in quantity and the number of
        // stock units in base_quantity: 3 packs of 100 is quantity 3, base_quantity 300. Stock is
        // held in base units, so every quantity sitting beside opening, received and closing has to
        // be the base one, while revenue stays quantity x unit_price because the price is per pack.
        $soldBaseUnits = 'SUM(COALESCE(order_items.base_quantity, order_items.quantity))';

        // Pricing filter (NSPH, NSPD ... or "none" for lines sold without a code): Sold and the values
        // count only that list's lines (the code on the order line); stock (opening/closing) stays the
        // item's whole stock, so opening is worked out from all its sales.
        $priceList = trim((string) ($filters['price_list'] ?? ''));
        $onList = $priceList === ''
            ? 'TRUE'
            : ($priceList === 'none'
                ? "COALESCE(order_items.price_label, '') = ''"
                : "split_part(COALESCE(order_items.price_label, ''), ' ', 1) = " . DB::getPdo()->quote($priceList));
        $listSoldBaseUnits = "SUM(CASE WHEN {$onList} THEN COALESCE(order_items.base_quantity, order_items.quantity) ELSE 0 END)";
        $listRevenue = "SUM(CASE WHEN {$onList} THEN order_items.quantity * order_items.unit_price + COALESCE(order_items.tax_amount, 0) ELSE 0 END)";

        // Sales that took stock between two moments, per size and per item without a size. A deleted
        // order gave its stock back, so it is not a sale.
        $salesBetween = function (Carbon $from, Carbon $to, string $by) use ($variantIds, $productIds, $soldBaseUnits, $listSoldBaseUnits, $listRevenue) {
            $column = "order_items.{$by}";
            return DB::table('order_items')
                ->join('orders', 'order_items.order_id', '=', 'orders.id')
                ->where('orders.company_id', $this->companyId)
                ->whereNull('orders.deleted_at')
                ->whereNotIn('orders.status', ['cancelled', 'rejected'])
                ->when($by === 'variant_id',
                    fn ($q) => $q->whereIn('order_items.variant_id', $variantIds),
                    // Sales recorded directly against the product with no size - the only case for items
                    // without sizes, but also possible on a sized item sold without picking a size.
                    fn ($q) => $q->whereIn('order_items.product_id', $productIds)->whereNull('order_items.variant_id'))
                ->whereNotNull('orders.stock_deducted_at')
                ->whereBetween('orders.stock_deducted_at', [$from, $to])
                ->groupBy($column)
                ->select(
                    DB::raw("{$column} as line_id"),
                    DB::raw("{$soldBaseUnits} as quantity_sold"),
                    DB::raw("{$listSoldBaseUnits} as list_quantity_sold"),
                    DB::raw("{$listRevenue} as revenue")
                )
                ->get()
                ->keyBy('line_id');
        };

        // Every other change to stock from the movement ledger, per line: goods received, and the
        // returns and adjustments (credit-note returns, returns to supplier, stock adjustments and counts,
        // opening-stock imports, write-offs). Left out because they are not a change in stock: sale
        // movements (sales come from the orders above), an order's own edit/delete restores (that sale is
        // no longer counted either), dispatch hand-overs and allocate/release bookkeeping.
        $movementsBetween = function (Carbon $from, ?Carbon $to) use ($productIds) {
            return InventoryMovement::query()
                ->where('company_id', $this->companyId)
                ->whereIn('product_id', $productIds)
                ->where('movement_date', '>=', $from)
                ->when($to, fn ($q) => $q->where('movement_date', '<=', $to))
                ->where('type', '!=', 'sale')
                ->where(fn ($q) => $q->whereNull('reference_type')
                    ->orWhereNotIn('reference_type', ['order', 'dispatch', 'App\\Models\\Order', 'App\\Models\\Dispatch']))
                ->whereRaw("COALESCE(metadata->>'movement_subtype', '') NOT IN ('allocation', 'deallocation')")
                ->groupBy('product_id', 'variant_id')
                ->select(
                    'product_id',
                    'variant_id',
                    DB::raw("SUM(CASE WHEN type = 'receipt' THEN quantity ELSE 0 END) as received"),
                    DB::raw("SUM(CASE WHEN type = 'receipt' THEN 0 ELSE quantity END) as other")
                )
                ->get()
                ->keyBy(fn ($m) => $m->product_id . '|' . ($m->variant_id ?? ''));
        };

        $salesByVariant = $salesBetween($dateFrom, $dateTo, 'variant_id');
        $salesByProduct = $salesBetween($dateFrom, $dateTo, 'product_id');
        $moves = $movementsBetween($dateFrom, $dateTo);

        // Closing is the stock at the end of the "To" date, not today's: a period that ended earlier
        // takes off what came in after it and adds back what was sold after it.
        $closesToday = $dateTo->greaterThanOrEqualTo(Carbon::now());
        $after = $closesToday ? null : [
            'variant' => $salesBetween($dateTo->copy()->addSecond(), Carbon::now()->addYear(), 'variant_id'),
            'product' => $salesBetween($dateTo->copy()->addSecond(), Carbon::now()->addYear(), 'product_id'),
            'moves' => $movementsBetween($dateTo->copy()->addSecond(), null),
        ];

        $withPeriod = function (array $row) use ($salesByVariant, $salesByProduct, $moves, $after, $periodMonths) {
            $variantId = $row['variant_id'];
            $key = $row['product_id'] . '|' . ($variantId ?? '');
            $sales = $variantId ? $salesByVariant->get($variantId) : $salesByProduct->get($row['product_id']);
            $move = $moves->get($key);
            $allSold = (int) ($sales->quantity_sold ?? 0);
            $quantitySold = (int) ($sales->list_quantity_sold ?? 0);
            $revenue = (float) ($sales->revenue ?? 0);
            $quantityReceived = (int) ($move->received ?? 0);
            $other = (int) ($move->other ?? 0);

            $closingStock = (int) $row['stock_quantity'];
            if ($after) {
                $soldAfter = $variantId ? $after['variant']->get($variantId) : $after['product']->get($row['product_id']);
                $movedAfter = $after['moves']->get($key);
                $closingStock = $closingStock - (int) ($movedAfter->received ?? 0) - (int) ($movedAfter->other ?? 0) + (int) ($soldAfter->quantity_sold ?? 0);
            }
            $unitCost = (float) $row['unit_cost'];

            $avgMonthlySales = $allSold / $periodMonths; // cover: all its sales, whatever the pricing filter
            $monthsOfStock = $avgMonthlySales > 0 ? round($closingStock / $avgMonthlySales, 1) : null;

            return $row + [
                // Opening + Received + Returns/Adj. - Sold (all pricing) = Closing.
                'opening_stock' => $closingStock - $quantityReceived - $other + $allSold,
                'stock_received' => $quantityReceived,
                'stock_other' => $other,
                'sales_quantity' => $quantitySold,
                'all_sales_quantity' => $allSold,
                'closing_stock' => $closingStock,
                'closing_stock_value' => round($closingStock * $unitCost, 2),
                'sales_revenue' => round($revenue, 2),
                'gross_profit' => round($revenue - ($quantitySold * $unitCost), 2),
                'cost_of_sales' => round($quantitySold * $unitCost, 2),
                // Profit % = gross profit / cost x 100 (on cost, as the user defines it).
                'profit_pct' => $quantitySold * $unitCost > 0 ? round(($revenue - $quantitySold * $unitCost) / ($quantitySold * $unitCost) * 100, 1) : null,
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
            $unsizedOnList = (int) ($unsized->list_quantity_sold ?? 0);
            foreach (['stock_received', 'stock_other', 'closing_stock'] as $field) {
                $row[$field] = $sizes->sum($field);
            }
            $row['sales_quantity'] = $sizes->sum('sales_quantity') + $unsizedOnList;
            $row['closing_stock_value'] = round($sizes->sum('closing_stock_value'), 2);
            $row['sales_revenue'] = round($sizes->sum('sales_revenue') + (float) ($unsized->revenue ?? 0), 2);
            $row['gross_profit'] = round($sizes->sum('gross_profit') + (float) ($unsized->revenue ?? 0), 2);
            $row['cost_of_sales'] = round($sizes->sum('cost_of_sales'), 2);
            $row['profit_pct'] = $row['cost_of_sales'] > 0 ? round($row['gross_profit'] / $row['cost_of_sales'] * 100, 1) : null;
            $row['avg_monthly_sales'] = null;
            $row['months_of_stock'] = null;
            $row['needs_reorder'] = $sizes->contains('needs_reorder', true);
            return $row;
        })->values();

        if ($priceList !== '') {
            $onTier = $priceList === 'none'
                ? collect()
                : DB::table('product_price_tiers')->where('company_id', $this->companyId)->where('tier_name', $priceList)->pluck('product_id')->unique();
            $keep = $onTier->merge($items->where('sales_quantity', '>', 0)->pluck('product_id'))->flip();
            $items = $items->filter(fn ($r) => $keep->has($r['product_id']))->values();
        }

        $summaryLines = $items->where('row_type', '!=', 'parent');

        // Credit notes dated in the period, for the items in this report, deducted at the end: what they
        // credited comes off sales and the cost of the goods back comes off cost. Lines without any cost
        // are left out of profit (their amount is shown), as sales without a cost are.
        $credits = collect(app(CreditNoteProfitService::class)->lines(
            $this->companyId, $dateFrom->toDateString(), $dateTo->toDateString(), $productIds->all()))
            ->when($priceList !== '', fn ($c) => $c->filter(fn ($l) => $priceList === 'none' ? empty($l['price_list']) : ($l['price_list'] ?? null) === $priceList))
            ->values();
        // Each item row carries its own credit notes, so the deduction follows the table's search and
        // filters (searching one item deducts only that item's credit notes). Credits are per product, so
        // they sit on the item's top row (its own row, or the parent of its sizes).
        $byProduct = $credits->groupBy('product_id');
        $itemsWithCredits = $items->map(function ($row) use ($byProduct) {
            if (!in_array($row['row_type'] ?? 'item', ['item', 'parent'], true)) {
                return $row;
            }
            $mine = $byProduct->get($row['product_id']);
            $row['credited_value'] = $mine ? round($mine->sum('amount'), 2) : 0.0;
            $row['credited_cost'] = $mine ? round($mine->sum('cost'), 2) : 0.0;
            $row['credited_uncosted'] = $mine ? round($mine->whereNull('cost')->sum('amount'), 2) : 0.0;
            $row['credit_notes'] = $mine ? $mine->pluck('credit_note_number')->unique()->values()->all() : [];
            return $row;
        });

        // Profit = total value - cost value throughout, credit notes included (a credited line with no
        // cost recorded takes its whole value off profit; the report flags it).
        $top = $items->whereIn('row_type', ['item', 'parent']);
        $salesValue = round($top->sum('sales_revenue'), 2);
        $grossBefore = round($top->sum('gross_profit'), 2);
        $costOfSales = round($top->sum('cost_of_sales'), 2);
        $creditValue = round($credits->sum('amount'), 2);
        $creditCost = round($credits->sum('cost'), 2);
        $creditProfit = round($creditValue - $creditCost, 2);
        $netCost = round($costOfSales - $creditCost, 2);
        $netProfit = round($grossBefore - $creditProfit, 2);

        return [
            'data' => $itemsWithCredits->toArray(),
            'price_lists' => DB::table('product_price_tiers')->where('company_id', $this->companyId)
                ->whereNotNull('tier_name')->where('tier_name', '!=', '')->distinct()->orderBy('tier_name')->pluck('tier_name')->values()->all(),
            'price_list' => $priceList ?: null,
            'period' => [
                'date_from' => $dateFrom->toDateString(),
                'date_to' => $dateTo->toDateString(),
                'months' => round($periodMonths, 2),
                // Closing figures are as at the end of date_to (today's stock when the range ends today).
                'closing_as_at' => $closesToday ? Carbon::now()->toDateString() : $dateTo->toDateString(),
            ],
            'summary' => [
                'total_items' => $summaryLines->count(),
                'total_closing_stock' => $summaryLines->sum('closing_stock'),
                'total_received' => $summaryLines->sum('stock_received'),
                'total_other' => $summaryLines->sum('stock_other'),
                'total_closing_stock_value' => round($summaryLines->sum('closing_stock_value'), 2),
                'total_sales_quantity' => $summaryLines->sum('sales_quantity'),
                'total_sales_value' => $salesValue,
                'total_gross_profit' => $grossBefore,
                'total_cost_of_sales' => $costOfSales,
                'total_profit_pct' => $costOfSales > 0 ? round($grossBefore / $costOfSales * 100, 1) : null,
                'credit_notes' => [
                    'count' => $credits->pluck('credit_note_id')->unique()->count(),
                    'numbers' => $credits->pluck('credit_note_number')->unique()->values()->all(),
                    'amount' => $creditValue,
                    'cost' => $creditCost,
                    'profit' => $creditProfit,
                    'uncosted_amount' => round($credits->whereNull('cost')->sum('amount'), 2),
                ],
                'net_sales_value' => round($salesValue - $creditValue, 2),
                'net_cost_value' => $netCost,
                'net_gross_profit' => $netProfit,
                'net_profit_pct' => $netCost > 0 ? round($netProfit / $netCost * 100, 1) : null,
                'reorder_alert_count' => $summaryLines->where('needs_reorder', true)->count(),
            ],
        ];
    }

    /**
     * Stock Movement: one row per document per stock line, newest first.
     *
     * - An order shows once per line it took: the batches it drew from and every edit of the order
     *   (each edit puts the stock back and takes it again) are netted into one row, the batches listed.
     *   An order whose stock all came back (deleted, or edited to nothing) is not shown.
     * - The same for a receipt, credit note or adjustment spread over several batches.
     * - Before / After are the line's own stock (the item or size, all batches), worked back from
     *   today's stock through the ledger, so a sale and a receipt read on the same scale.
     * - Allocate/release bookkeeping is left out. Internal dispatches are shown without Before/After:
     *   their ledger rows track the batch hand-over, not the item's stock.
     */
    public function getInventoryMovementLog(array $filters = []): array
    {
        $query = InventoryMovement::whereHas('product', function ($q) use ($filters) {
            $q->where('company_id', $this->companyId);
            $this->applyInventoryFilters($q, array_diff_key($filters, ['store_id' => true]));
        })->whereRaw("COALESCE(metadata->>'movement_subtype', '') NOT IN ('allocation', 'deallocation')");

        if (isset($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
            // One line of a sized item: a size, or "none" for the item itself (no size).
            if (($filters['variant_id'] ?? '') === 'none') {
                $query->whereNull('variant_id');
            } elseif (!empty($filters['variant_id'])) {
                $query->where('variant_id', $filters['variant_id']);
            }
        }
        $from = isset($filters['date_from']) ? Carbon::parse($filters['date_from'])->startOfDay() : null;
        $to = isset($filters['date_to']) ? Carbon::parse($filters['date_to'])->endOfDay() : null;
        // Which way: "out" (sales, returns to supplier, write-offs ...) or "in".
        $direction = $filters['direction'] ?? null;

        // Every movement up to the end of the range (all stores): the running stock is worked back from
        // today's, so later movements are needed too. Only the range is shown.
        $stockLines = $this->stockLines()->where('row_type', '!=', 'parent')
            ->mapWithKeys(fn ($r) => [$r['product_id'] . '|' . ($r['variant_id'] ?? '') => $r]);

        $raw = $query->with(['product:id,name,item_number', 'variant:id,name', 'batch:id,batch_number'])
            ->get();

        $kind = fn ($m) => \Illuminate\Support\Str::snake(class_basename((string) $m->reference_type));
        $groups = $raw->groupBy(function ($m) use ($kind) {
            $line = $m->product_id . '|' . ($m->variant_id ?? '');
            if (!$m->reference_id && !$m->reference_number) {
                return 'm|' . $m->id;
            }
            $ref = $kind($m) . '|' . ($m->reference_id ?: $m->reference_number);
            // An order's sales and its edit/delete restores net together; elsewhere one row per type.
            return $ref . '|' . $line . '|' . ($kind($m) === 'order' ? 'order' : $m->type);
        });

        $rows = $groups->map(function ($ms) use ($kind) {
            $first = $ms->sortBy('created_at')->first();
            $net = (int) $ms->sum('quantity');
            $isOrder = $kind($first) === 'order';
            $last = $ms->sortByDesc(fn ($m) => ($m->movement_date ?? $m->created_at)?->format('Y-m-d H:i:s.u'))->first();
            // Batches that still hold the result: an order's batch whose sale was later fully restored is not listed.
            $batches = $ms->groupBy('batch_id')
                ->filter(fn ($b) => !$isOrder || (int) $b->sum('quantity') !== 0)
                ->map(fn ($b) => $b->first()->batch?->batch_number)->filter()->unique()->values();
            return (object) [
                'rep' => $first,
                'line' => $first->product_id . '|' . ($first->variant_id ?? ''),
                'date' => $last->movement_date ?? $last->created_at,
                'created' => $last->created_at,
                'type' => $isOrder ? ($net < 0 ? 'sale' : 'return') : $first->type,
                'net' => $net,
                'store_id' => $first->store_id,
                'batches' => $batches->implode(', '),
                'tracks_stock' => $kind($first) !== 'dispatch',
                'count' => $ms->count(),
            ];
        })
            // Fully reversed (an order deleted or edited to nothing): no stock moved.
            ->filter(fn ($g) => !($g->net === 0 && $g->count > 1))
            ->sortByDesc(fn ($g) => Carbon::parse($g->date)->format('Y-m-d H:i:s.u') . Carbon::parse($g->created)->format('H:i:s.u'))
            ->values();

        // Before / After: walk back from today's stock of each line.
        $running = $stockLines->map(fn ($r) => (int) $r['stock_quantity'])->all();
        foreach ($rows as $g) {
            if (!$g->tracks_stock || !array_key_exists($g->line, $running)) {
                $g->before = $g->after = null;
                continue;
            }
            $g->after = $running[$g->line];
            $g->before = $g->after - $g->net;
            $running[$g->line] = $g->before;
        }

        $shown = $rows->filter(function ($g) use ($from, $to, $filters) {
            $d = Carbon::parse($g->date);
            return (!$from || $d->gte($from)) && (!$to || $d->lte($to))
                && (!isset($filters['store_id']) || $g->store_id === $filters['store_id']);
        })->values();
        $refs = $this->movementReferences($shown->pluck('rep'));

        $movements = $shown
            ->map(function ($g) use ($stockLines, $refs) {
                $m = $g->rep;
                $line = $stockLines->get($g->line);
                $inbound = $g->net >= 0
                    && !in_array($g->type, ['sale', 'dispatch', 'damage', 'expired', 'adjustment_out', 'transfer_out'], true);
                $ref = $refs[$m->id] ?? [];
                return [
                    'id' => $m->id,
                    'movement_date' => $g->date,
                    'item_no' => $line['item_no'] ?? (string) ($m->product->item_number ?? ''),
                    'product_id' => $m->product_id,
                    'variant_id' => $m->variant_id,
                    'name' => $m->product
                        ? \App\Models\ProductVariant::sizedName($m->product->name, $m->variant?->name)
                        : 'Unknown item',
                    'type' => $g->type,
                    'direction' => $inbound ? 'in' : 'out',
                    'quantity' => abs($g->net),
                    'quantity_before' => $g->before,
                    'quantity_after' => $g->after,
                    'batch_number' => $g->batches !== '' ? $g->batches : null,
                    // Where the stock went or came from: the document (a sale shows its invoice) and the
                    // customer or supplier, each with the page to open it on.
                    'reference_type' => $ref['label'] ?? ($m->reference_type ? \Illuminate\Support\Str::headline(class_basename($m->reference_type)) : null),
                    'reference_number' => $ref['number'] ?? self::shortDocNumber($m->reference_number),
                    'reference_link' => $ref['link'] ?? null,
                    'party' => $ref['party'] ?? null,
                    'party_link' => $ref['party_link'] ?? null,
                    'notes' => $m->notes,
                    'unit_cost' => $m->unit_cost !== null ? (float) $m->unit_cost : null,
                ];
            })
            ->when(in_array($direction, ['in', 'out'], true), fn ($c) => $c->where('direction', $direction))
            ->values();

        return [
            'data' => $movements->toArray(),
            'summary' => [
                'total_movements' => $movements->count(),
                'total_in' => $movements->where('direction', 'in')->sum('quantity'),
                'total_out' => $movements->where('direction', 'out')->sum('quantity'),
            ],
        ];
    }

    /** RCPT-853b296e-0074 -> RCPT-0074: the company part of long document numbers is never shown. */
    public static function shortDocNumber(?string $number): ?string
    {
        return $number === null ? null : preg_replace('/^([A-Za-z]+)-[0-9a-f]{8}-(\d+)$/', '$1-$2', $number);
    }

    /**
     * For each movement: the document it came from as people know it (a sale shows its NSK invoice, ORD only
     * before invoicing), the customer (by business name) or supplier, and the pages to open them on.
     * Loaded in one query per kind of document. Keyed by movement id.
     */
    protected function movementReferences(\Illuminate\Support\Collection $movements): array
    {
        $kind = fn ($m) => \Illuminate\Support\Str::snake(class_basename((string) $m->reference_type));
        $idsOf = function (array $kinds) use ($movements, $kind) {
            return $movements->filter(fn ($m) => in_array($kind($m), $kinds, true) && $m->reference_id)->pluck('reference_id')->unique()->values()->all();
        };
        $customerName = "coalesce(nullif(trim(customers.business_name), ''), customers.name) as customer_name";

        $orders = collect();
        if ($ids = $idsOf(['order'])) {
            $orders = DB::table('orders')->leftJoin('customers', 'customers.id', '=', 'orders.customer_id')
                ->whereIn('orders.id', $ids)
                ->select('orders.id', 'orders.order_number', 'orders.customer_id', DB::raw($customerName))
                ->get()->keyBy('id');
            $invoices = DB::table('invoices')->whereIn('order_id', $ids)
                ->where(fn ($q) => $q->whereNull('type')->orWhereNotIn('type', ['proforma', 'credit_note']))
                ->orderByRaw("CASE WHEN file_number ~ '^[0-9]+$' THEN 0 ELSE 1 END") // an NSK invoice (has a File No) first
                ->orderByRaw("CASE WHEN status IN ('cancelled', 'void', 'voided') THEN 1 ELSE 0 END")
                ->orderByDesc('created_at')
                ->get(['id', 'order_id', 'invoice_number', 'file_number'])
                ->unique('order_id')->keyBy('order_id');
            $orders = $orders->map(function ($o) use ($invoices) {
                $o->invoice = $invoices->get($o->id);
                return $o;
            });
        }
        $creditNotes = ($ids = $idsOf(['credit_note']))
            ? DB::table('credit_notes')->leftJoin('customers', 'customers.id', '=', 'credit_notes.customer_id')
                ->whereIn('credit_notes.id', $ids)
                ->select('credit_notes.id', 'credit_notes.credit_note_number', 'credit_notes.customer_id', DB::raw($customerName))
                ->get()->keyBy('id')
            : collect();
        $receipts = ($ids = $idsOf(['product_receipt']))
            ? DB::table('product_receipts')->leftJoin('suppliers', 'suppliers.id', '=', 'product_receipts.supplier_id')
                ->whereIn('product_receipts.id', $ids)
                ->select('product_receipts.id', 'product_receipts.product_receipt_number', 'suppliers.name as supplier_name')
                ->get()->keyBy('id')
            : collect();
        $debitNotes = ($ids = $idsOf(['supplier_debit_note']))
            ? DB::table('accounts_payable')->leftJoin('suppliers', 'suppliers.id', '=', 'accounts_payable.vendor_id')
                ->whereIn('accounts_payable.id', $ids)
                ->select('accounts_payable.id', 'accounts_payable.invoice_number', 'suppliers.name as supplier_name')
                ->get()->keyBy('id')
            : collect();
        $dispatches = ($ids = $idsOf(['dispatch']))
            ? DB::table('dispatches')->leftJoin('users', 'users.id', '=', 'dispatches.to_user_id')
                ->whereIn('dispatches.id', $ids)
                ->select('dispatches.id', 'dispatches.dispatch_number', 'dispatches.to_entity', DB::raw("trim(concat(users.first_name, ' ', users.last_name)) as to_user"))
                ->get()->keyBy('id')
            : collect();

        $out = [];
        foreach ($movements as $m) {
            $id = $m->reference_id;
            $number = self::shortDocNumber($m->reference_number);
            $customer = fn ($row) => $row && $row->customer_id
                ? ['party' => $row->customer_name, 'party_link' => "/customers/{$row->customer_id}/statement"]
                : [];
            $out[$m->id] = match ($kind($m)) {
                'order' => (function () use ($orders, $id, $number, $customer) {
                    $o = $orders->get($id);
                    // A sale is shown by its invoice: the NSK number, or the invoice's own number
                    // (INV-0491) while it has no NSK yet. ORD only when there is no invoice at all.
                    $inv = $o?->invoice;
                    return [
                        'label' => $inv ? 'Invoice' : 'Order',
                        'number' => $inv ? \App\Models\Invoice::printedNumber($inv->invoice_number, $inv->file_number) : self::shortDocNumber($o->order_number ?? null) ?? $number,
                        'link' => $inv ? "/sales/invoices/{$inv->id}" : ($o ? "/sales/orders/{$o->id}" : null),
                    ] + $customer($o);
                })(),
                'credit_note' => (function () use ($creditNotes, $id, $number, $customer) {
                    $c = $creditNotes->get($id);
                    return ['label' => 'Credit note', 'number' => $c->credit_note_number ?? $number, 'link' => $c ? "/sales/credit-notes/{$c->id}" : null] + $customer($c);
                })(),
                'product_receipt' => (function () use ($receipts, $id, $number) {
                    $r = $receipts->get($id);
                    return ['label' => 'Goods received', 'number' => self::shortDocNumber($r->product_receipt_number ?? null) ?? $number, 'link' => '/product-receipt', 'party' => $r->supplier_name ?? null];
                })(),
                'supplier_debit_note' => (function () use ($debitNotes, $id, $number) {
                    $d = $debitNotes->get($id);
                    return ['label' => 'Return to supplier', 'number' => $d->invoice_number ?? $number, 'link' => $d ? "/suppliers/debit-notes/{$d->id}/document" : null, 'party' => $d->supplier_name ?? null];
                })(),
                'dispatch' => (function () use ($dispatches, $id, $number) {
                    $d = $dispatches->get($id);
                    return ['label' => 'Dispatch', 'number' => self::shortDocNumber($d->dispatch_number ?? null) ?? $number, 'link' => '/dispatch', 'party' => ($d->to_user ?? '') !== '' ? $d->to_user : ($d->to_entity ?? null)];
                })(),
                'stock_adjustment', 'stock_adjustment_item' => [
                    'label' => 'Stock adjustment',
                    'number' => $number,
                    'link' => ($adj = $kind($m) === 'stock_adjustment' ? $id : ($m->metadata['adjustment_id'] ?? null)) ? "/inventory/stock-adjustments/{$adj}" : '/inventory/stock-adjustments',
                ],
                'stock_count' => ['label' => 'Stock count', 'number' => $number, 'link' => $id ? "/inventory/stock-counts/{$id}" : '/inventory/stock-counts'],
                'opening_stock' => ['label' => 'Opening stock', 'number' => $number],
                'purchase_order_return' => ['label' => 'Return to supplier', 'number' => $number, 'link' => '/purchase-orders'],
                default => [],
            };
        }
        return $out;
    }

    /**
     * Where one stock line's sold units went, for the Sold figure in Stock Management: every sale that took
     * stock in the period (same rules as that figure) with its NSK invoice, customer, quantity and value.
     * Filters: product_id, variant_id (a size, "none" for the item itself, "all" for every size), date_from,
     * date_to, price_list.
     */
    public function getLineSales(array $filters = []): array
    {
        $dateTo = isset($filters['date_to']) ? Carbon::parse($filters['date_to'])->endOfDay() : Carbon::now();
        $dateFrom = isset($filters['date_from']) ? Carbon::parse($filters['date_from'])->startOfDay() : Carbon::now()->startOfMonth();
        $priceList = trim((string) ($filters['price_list'] ?? ''));
        $variant = $filters['variant_id'] ?? null;

        $rows = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->leftJoin('customers', 'customers.id', '=', 'orders.customer_id')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected'])
            ->where('order_items.product_id', $filters['product_id'] ?? '')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            // "all": a sized item with every size; "none" (or nothing): the item itself; else one size.
            ->when($variant !== 'all', fn ($q) => $variant === 'none' || $variant === null || $variant === ''
                ? $q->whereNull('order_items.variant_id')
                : $q->where('order_items.variant_id', $variant))
            ->whereNotNull('orders.stock_deducted_at')
            ->whereBetween('orders.stock_deducted_at', [$dateFrom, $dateTo])
            ->when($priceList !== '', fn ($q) => $priceList === 'none'
                ? $q->whereRaw("COALESCE(order_items.price_label, '') = ''")
                : $q->whereRaw("split_part(COALESCE(order_items.price_label, ''), ' ', 1) = ?", [$priceList]))
            ->orderBy('orders.stock_deducted_at')
            ->select(
                'orders.id as order_id', 'orders.order_number', 'orders.stock_deducted_at', 'orders.customer_id',
                DB::raw("coalesce(nullif(trim(customers.business_name), ''), customers.name) as customer_name"),
                DB::raw('COALESCE(order_items.base_quantity, order_items.quantity) as quantity'),
                'order_items.unit_price', 'order_items.price_label', 'product_variants.name as size',
                DB::raw('order_items.quantity * order_items.unit_price + COALESCE(order_items.tax_amount, 0) as value')
            )
            ->get();

        // NSK first; an invoice still without its NSK shows its own number (INV-0491).
        $invoices = DB::table('invoices')->whereIn('order_id', $rows->pluck('order_id')->unique())
            ->where(fn ($q) => $q->whereNull('type')->orWhereNotIn('type', ['proforma', 'credit_note']))
            ->orderByRaw("CASE WHEN file_number ~ '^[0-9]+$' THEN 0 ELSE 1 END") // an NSK invoice (has a File No) first
            ->orderByRaw("CASE WHEN status IN ('cancelled', 'void', 'voided') THEN 1 ELSE 0 END")
            ->orderByDesc('created_at')
            ->get(['id', 'order_id', 'invoice_number', 'file_number', 'invoice_date'])->unique('order_id')->keyBy('order_id');

        $data = $rows->map(function ($r) use ($invoices) {
            $inv = $invoices->get($r->order_id);
            return [
                'date' => $r->stock_deducted_at,
                'invoice_date' => $inv->invoice_date ?? null,
                'reference_number' => $inv ? \App\Models\Invoice::printedNumber($inv->invoice_number, $inv->file_number) : self::shortDocNumber($r->order_number),
                'reference_link' => $inv ? "/sales/invoices/{$inv->id}" : "/sales/orders/{$r->order_id}",
                'party' => $r->customer_name,
                'party_link' => $r->customer_id ? "/customers/{$r->customer_id}/statement" : null,
                'size' => $r->size,
                'price_label' => $r->price_label,
                'quantity' => (int) $r->quantity,
                'unit_price' => (float) $r->unit_price,
                'value' => round((float) $r->value, 2),
            ];
        })->values();

        return [
            'data' => $data->all(),
            'summary' => [
                'total_quantity' => $data->sum('quantity'),
                'total_value' => round($data->sum('value'), 2),
                'invoices' => $data->pluck('reference_number')->unique()->count(),
                'customers' => $data->pluck('party')->filter()->unique()->count(),
            ],
        ];
    }

    /**
     * 2. SALES REPORTS
     */

    public function getSalesPerformanceSummary(array $filters = []): array
    {
        $query = Order::query()->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

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
            // Same filters as everything else on the report (it used to honour dates only).
            'total_items_count' => (function () use ($filters) {
                $q = DB::table('order_items')
                    ->join('orders', 'order_items.order_id', '=', 'orders.id')
                    ->where('orders.company_id', $this->companyId)
                    ->whereNotIn('orders.status', ['cancelled', 'rejected']);
                $this->applyOrderFilters($q, $filters);
                return $q->sum('order_items.quantity');
            })(),
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
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

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
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

        $this->applyOrderFilters($topCategoriesQuery, $filters);

        // Products are filed under a category record; the old free-text column is the fallback.
        $topCategories = $topCategoriesQuery
            ->leftJoin('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->select(DB::raw("COALESCE(product_categories.name, products.category, 'Uncategorized') as category"), DB::raw('SUM(order_items.quantity * order_items.unit_price) as total_revenue'))
            ->groupBy(DB::raw("COALESCE(product_categories.name, products.category, 'Uncategorized')"))
            ->orderBy('total_revenue', 'desc')
            ->get()->toArray();

        // Top Products - build query with all filters
        $topProductsQuery = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

        $this->applyOrderFilters($topProductsQuery, $filters);

        $topProducts = $topProductsQuery
            ->select('products.name', 'products.sku', DB::raw('SUM(order_items.quantity) as total_quantity'), DB::raw('SUM(order_items.quantity * order_items.unit_price) as total_revenue'))
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderBy('total_revenue', 'desc')
            ->limit(200)
            ->get()->toArray();

        // Top Customers - build query with all filters
        $topCustomersQuery = DB::table('orders')
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->leftJoin('delivery_locations', 'orders.delivery_location_id', '=', 'delivery_locations.id')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

        $this->applyOrderFilters($topCustomersQuery, $filters);

        $topCustomers = $topCustomersQuery
            ->select(
                DB::raw("COALESCE(NULLIF(TRIM(customers.business_name), ''), customers.name) as name"),
                DB::raw("COALESCE(delivery_locations.city, customers.city, 'Unknown') as location"),
                DB::raw("COALESCE(customers.county, 'Unknown') as county"),
                DB::raw("COALESCE(customers.region, 'Unknown') as region"),
                DB::raw('COUNT(*) as order_count'),
                DB::raw('SUM(orders.final_amount) as total_spent')
            )
            ->groupBy('customers.id', 'customers.name', 'customers.customer_type', 'customers.business_name', 'delivery_locations.city', 'customers.city', 'customers.county', 'customers.region')
            ->orderBy('total_spent', 'desc')
            ->limit(500)
            ->get()->toArray();

        // Sales by where the customer is: region, county and town, each with its share of the total.
        $byLocation = function (string $column) use ($filters) {
            $q = DB::table('orders')
                ->join('customers', 'orders.customer_id', '=', 'customers.id')
                ->where('orders.company_id', $this->companyId)
                ->whereNotIn('orders.status', ['cancelled', 'rejected']);
            $this->applyOrderFilters($q, $filters);
            $rows = $q->select(
                DB::raw("COALESCE(NULLIF(TRIM(customers.{$column}), ''), 'Unknown') as name"),
                DB::raw('COUNT(DISTINCT customers.id) as customer_count'),
                DB::raw('COUNT(*) as order_count'),
                DB::raw('SUM(orders.final_amount) as total')
            )
                ->groupBy(DB::raw("COALESCE(NULLIF(TRIM(customers.{$column}), ''), 'Unknown')"))
                ->orderBy('total', 'desc')
                ->get();
            $sum = (float) $rows->sum('total');
            return $rows->map(fn ($r) => [
                'name' => $r->name,
                'customer_count' => (int) $r->customer_count,
                'order_count' => (int) $r->order_count,
                'total' => round((float) $r->total, 2),
                'average_order' => $r->order_count ? round((float) $r->total / $r->order_count, 2) : 0,
                'share' => $sum > 0 ? round((float) $r->total / $sum * 100, 1) : 0,
            ])->values()->all();
        };

        // Sales by the rep on each order.
        $repQuery = DB::table('orders')
            ->leftJoin('users', 'orders.sales_rep_id', '=', 'users.id')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);
        $this->applyOrderFilters($repQuery, $filters);
        $repRows = $repQuery->select(
            DB::raw("COALESCE(orders.sales_rep_id::text, 'unassigned') as id"),
            DB::raw("COALESCE(NULLIF(TRIM(CONCAT(users.first_name, ' ', users.last_name)), ''), 'Unassigned') as name"),
            DB::raw('COUNT(DISTINCT orders.customer_id) as customer_count'),
            DB::raw('COUNT(*) as order_count'),
            DB::raw('SUM(orders.final_amount) as total')
        )->groupBy('orders.sales_rep_id', 'users.first_name', 'users.last_name')->orderBy('total', 'desc')->get();
        $repSum = (float) $repRows->sum('total');
        $salesByRep = $repRows->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name,
            'customer_count' => (int) $r->customer_count,
            'order_count' => (int) $r->order_count,
            'total' => round((float) $r->total, 2),
            'average_order' => $r->order_count ? round((float) $r->total / $r->order_count, 2) : 0,
            'share' => $repSum > 0 ? round((float) $r->total / $repSum * 100, 1) : 0,
        ])->values()->all();

        // Filter choices narrow to what still applies: a chosen customer offers only their own
        // region / county / town, a region only its counties, a county only its towns.
        $options = function (string $column, array $narrowBy) use ($filters) {
            $q = DB::table('customers')->where('company_id', $this->companyId)
                ->whereNull('deleted_at')->whereNotNull($column)->whereRaw("TRIM({$column}) <> ''");
            if (!empty($filters['customer_id'])) {
                $q->where('id', $filters['customer_id']);
            }
            foreach ($narrowBy as $parent) {
                if (!empty($filters[$parent])) {
                    $q->whereRaw("LOWER(TRIM({$parent})) = ?", [mb_strtolower(trim($filters[$parent]))]);
                }
            }
            return $q->distinct()->orderBy($column)->pluck($column)->values()->all();
        };

        // Rep choices: for a chosen customer or place, the reps on those orders; otherwise every
        // sales-rep user plus anyone already on an order.
        $narrowed = !empty($filters['customer_id']) || !empty($filters['region']) || !empty($filters['county']) || !empty($filters['city']);
        $repsOnOrders = DB::table('orders')->where('company_id', $this->companyId)->whereNotNull('sales_rep_id');
        if ($narrowed) {
            $this->applyOrderFilters($repsOnOrders, array_diff_key($filters, ['sales_rep_id' => 1]));
        }
        $repOptions = DB::table('users')
            ->where('company_id', $this->companyId)
            ->where(fn ($q) => $q->whereIn('id', $repsOnOrders->select('sales_rep_id'))
                ->when(!$narrowed, fn ($q) => $q->orWhereIn('role_id', DB::table('roles')->whereRaw('is_sales_rep = true')->select('id'))))
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name'])
            ->map(fn ($u) => ['id' => $u->id, 'name' => trim("{$u->first_name} {$u->last_name}")])
            ->values()->all();

        // Every order behind the figures above (same filters), newest first.
        $ordersQuery = DB::table('orders')
            ->leftJoin('customers', 'orders.customer_id', '=', 'customers.id')
            ->leftJoin('users as rep', 'orders.sales_rep_id', '=', 'rep.id')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected'])
            ->whereNull('orders.deleted_at');
        $this->applyOrderFilters($ordersQuery, $filters);
        $orders = $ordersQuery
            ->orderByDesc('orders.order_date')
            ->limit(2000)
            ->get([
                'orders.id', 'orders.order_number', 'orders.order_date', 'orders.status', 'orders.payment_status',
                'orders.final_amount', 'orders.amount_paid', 'orders.tax',
                DB::raw("COALESCE(NULLIF(TRIM(customers.business_name), ''), customers.name) as customer"),
                'customers.county', 'customers.region', 'customers.city',
                DB::raw("NULLIF(TRIM(CONCAT(rep.first_name, ' ', rep.last_name)), '') as sales_rep"),
                DB::raw('(SELECT i.invoice_number FROM invoices i WHERE i.order_id = orders.id ORDER BY i.created_at LIMIT 1) as invoice_number'),
                DB::raw('(SELECT i.file_number FROM invoices i WHERE i.order_id = orders.id ORDER BY i.created_at LIMIT 1) as invoice_file_number'),
            ])
            ->map(fn ($o) => [
                'id' => $o->id,
                // Shown short (ORD-0299) like everywhere else - see Order::getOrderNumberAttribute.
                'order_number' => preg_match('/^(ORD)-(?:[\w-]+)-(\d{4})$/', (string) $o->order_number, $m) ? "{$m[1]}-{$m[2]}" : $o->order_number,
                // Its invoice as printed: NSK/0427.
                'invoice_number' => $o->invoice_number ? \App\Models\Invoice::printedNumber($o->invoice_number, $o->invoice_file_number) : null,
                // Its voucher number on the sales accounts: NSK/0427 only when it has a File No.
                'vch_no' => preg_match('/^\d+$/', trim((string) $o->invoice_file_number)) ? \App\Models\Invoice::printedNumber(null, $o->invoice_file_number) : null,
                'file_no' => preg_match('/^\d+$/', trim((string) $o->invoice_file_number)) ? (int) $o->invoice_file_number : null,
                'order_date' => $o->order_date ? substr((string) $o->order_date, 0, 10) : null,
                'customer' => $o->customer,
                'county' => $o->county,
                'region' => $o->region,
                'town' => $o->city,
                'sales_rep' => $o->sales_rep ?? 'Unassigned',
                'status' => $o->status,
                'payment_status' => $o->payment_status,
                'total' => round((float) $o->final_amount, 2),
                'paid' => round((float) $o->amount_paid, 2),
                'vat' => round((float) $o->tax, 2),
            ])->values()->all();

        // Sales accounts, as the old system printed them: each order a Sales voucher credited
        // under its NSK number, each credit note a debit; oldest first (the page runs the balance).
        $creditNoteQuery = CreditNote::query()
            ->where('company_id', $this->companyId)
            ->whereIn('status', ['issued', 'applied', 'refunded']);
        $this->applyCreditNoteFilters($creditNoteQuery, $filters);
        $salesAccounts = collect($orders)->map(fn ($o) => [
            'date' => $o['order_date'],
            'particulars' => $o['customer'],
            'vch_type' => 'Sales',
            'vch_no' => $o['vch_no'],
            'debit' => 0,
            'credit' => $o['total'],
            'order_id' => $o['id'],
            'seq' => [0, $o['file_no'] ?? PHP_INT_MAX],
        ])->concat($creditNoteQuery->get([
            'id', 'credit_note_number', 'credit_note_date', 'total_amount',
            DB::raw("(SELECT COALESCE(NULLIF(TRIM(c.business_name), ''), c.name) FROM customers c WHERE c.id = credit_notes.customer_id) as customer"),
        ])->map(fn ($cn) => [
            'date' => $cn->credit_note_date ? substr((string) $cn->credit_note_date, 0, 10) : null,
            'particulars' => $cn->customer,
            'vch_type' => 'Credit Note',
            'vch_no' => $cn->credit_note_number,
            'debit' => round((float) $cn->total_amount, 2),
            'credit' => 0,
            'credit_note_id' => $cn->id,
            'seq' => [1, (int) preg_replace('/\D/', '', (string) $cn->credit_note_number)],
        ]))
            ->sort(fn ($a, $b) => [$a['date'], $a['seq']] <=> [$b['date'], $b['seq']])
            ->map(fn ($r) => array_diff_key($r, ['seq' => 1]))
            ->values()->all();

        // Receipts, for the page's "Show receipts" switch: each payment a debit, less any refund,
        // so the balance becomes what is still owed. A bounced cheque was never money in.
        $receiptsQuery = DB::table('payments as p')
            ->leftJoin('invoices as i', 'i.id', '=', 'p.invoice_id')
            ->leftJoin('orders as o', 'o.id', '=', DB::raw('COALESCE(p.order_id, i.order_id)'))
            ->leftJoin('customers as c', 'c.id', '=', DB::raw('COALESCE(p.customer_id, i.customer_id, o.customer_id)'))
            ->where('p.company_id', $this->companyId)
            ->where('p.status', 'completed')
            ->whereRaw('p.amount_paid - COALESCE(p.amount_refunded, 0) > 0')
            ->whereNotIn('p.id', DB::table('cheques')->where('direction', 'received')->where('status', 'bounced')->whereNotNull('payment_id')->select('payment_id'));
        $paidOn = 'DATE(COALESCE(p.payment_date, p.created_at))';
        if (isset($filters['date_from'])) {
            $receiptsQuery->whereRaw("$paidOn >= ?", [$filters['date_from']]);
        }
        if (isset($filters['date_to'])) {
            $receiptsQuery->whereRaw("$paidOn <= ?", [$filters['date_to']]);
        }
        if (isset($filters['customer_id'])) {
            $receiptsQuery->where('c.id', $filters['customer_id']);
        }
        if (!empty($filters['sales_rep_id'])) {
            $filters['sales_rep_id'] === 'unassigned'
                ? $receiptsQuery->whereNull('o.sales_rep_id')
                : $receiptsQuery->where('o.sales_rep_id', $filters['sales_rep_id']);
        }
        foreach (['region', 'county', 'city'] as $column) {
            if (!empty($filters[$column])) {
                $receiptsQuery->whereRaw("LOWER(TRIM(c.{$column})) = ?", [mb_strtolower(trim($filters[$column]))]);
            }
        }
        $salesReceipts = $receiptsQuery
            ->orderByRaw("$paidOn")->orderBy('p.created_at')
            ->get([
                'p.id', 'p.transaction_id', 'p.payment_method', 'p.amount_paid', 'p.amount_refunded',
                DB::raw("$paidOn as paid_on"),
                DB::raw("COALESCE(NULLIF(TRIM(c.business_name), ''), c.name) as customer"),
            ])
            ->map(fn ($p) => [
                'date' => substr((string) $p->paid_on, 0, 10),
                'particulars' => $p->customer,
                'vch_type' => 'Receipt',
                // The reference keyed on the receipt (cheque or M-Pesa code), else how it was paid.
                'vch_no' => trim((string) $p->transaction_id) ?: ucwords(str_replace('_', ' ', (string) $p->payment_method)),
                'debit' => round((float) $p->amount_paid - (float) $p->amount_refunded, 2),
                'credit' => 0,
                'payment_id' => $p->id,
            ])->values()->all();

        // Payment status breakdown - build query with all filters
        $paymentStatusQuery = DB::table('orders')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

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
            'sales_by_region' => $byLocation('region'),
            'sales_by_county' => $byLocation('county'),
            'sales_by_city' => $byLocation('city'),
            'sales_by_rep' => $salesByRep,
            'orders' => $orders,
            'sales_accounts' => $salesAccounts,
            'sales_receipts' => $salesReceipts,
            'sales_rep_options' => $repOptions,
            'location_options' => [
                'regions' => $options('region', []),
                'counties' => $options('county', ['region']),
                'cities' => $options('city', ['region', 'county']),
            ],
        ]);
    }

    public function getProductSalesRanking(array $filters = []): array
    {
        $query = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $this->companyId)
            ->whereNotIn('orders.status', ['cancelled', 'rejected']);

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

    // Dispatches raised in the period (by when they were created).
    private function dispatchesInPeriod(array $filters)
    {
        return OrderDispatch::query()
            ->where('order_dispatches.company_id', $this->companyId)
            ->when(!empty($filters['date_from']), fn ($q) => $q->where('order_dispatches.created_at', '>=', $filters['date_from']))
            ->when(!empty($filters['date_to']), fn ($q) => $q->where('order_dispatches.created_at', '<', \Carbon\Carbon::parse($filters['date_to'])->addDay()->toDateString()));
    }

    /**
     * How quickly each dispatch moved: raised -> approved -> delivered, in hours. (It used to
     * compare the planned dispatch date with the approval time, which gave negative hours and
     * left out every dispatch missing either.)
     */
    public function getDispatchEfficiencyReport(array $filters = []): array
    {
        $rows = $this->dispatchesInPeriod($filters)
            ->leftJoin('orders', 'orders.id', '=', 'order_dispatches.order_id')
            ->leftJoin('customers', 'customers.id', '=', 'orders.customer_id')
            ->orderByDesc('order_dispatches.created_at')
            ->get([
                'order_dispatches.id', 'order_dispatches.dispatch_number', 'order_dispatches.status', 'order_dispatches.approval_status',
                'order_dispatches.created_at', 'order_dispatches.final_approved_at', 'order_dispatches.actual_delivery_date',
                'orders.order_number', DB::raw('(SELECT i.file_number FROM invoices i WHERE i.order_id = orders.id ORDER BY i.created_at LIMIT 1) as invoice_file_number'),
                DB::raw("COALESCE(NULLIF(TRIM(customers.business_name), ''), customers.name) as customer"),
                'customers.county', 'customers.region',
            ]);

        // A past sale brought across from the old system was delivered before its dispatch record
        // existed, so a negative span means "not measurable", not a negative time.
        $hours = function ($from, $to) {
            if (!$from || !$to) {
                return null;
            }
            $h = round(\Carbon\Carbon::parse($from)->diffInMinutes(\Carbon\Carbon::parse($to), false) / 60, 1);
            return $h >= 0 ? $h : null;
        };
        $data = $rows->map(fn ($d) => [
            'id' => $d->id,
            'dispatch_number' => $d->dispatch_number,
            // Known by its invoice: NSK/0427.
            'order_number' => preg_match('/^\d+$/', trim((string) $d->invoice_file_number)) ? \App\Models\Invoice::printedNumber(null, $d->invoice_file_number) : $d->order_number,
            'customer' => $d->customer,
            'county' => $d->county,
            'region' => $d->region,
            'status' => $d->status,
            'approval_status' => $d->approval_status,
            'raised_at' => $d->created_at ? \Carbon\Carbon::parse($d->created_at)->toDateTimeString() : null,
            'approved_at' => $d->final_approved_at ? \Carbon\Carbon::parse($d->final_approved_at)->toDateTimeString() : null,
            'delivered_at' => $d->actual_delivery_date ? \Carbon\Carbon::parse($d->actual_delivery_date)->toDateTimeString() : null,
            'hours_to_approve' => $hours($d->created_at, $d->final_approved_at),
            'hours_to_deliver' => $hours($d->final_approved_at ?? $d->created_at, $d->actual_delivery_date),
        ])->values();

        $avg = fn (string $key) => ($v = $data->pluck($key)->filter(fn ($x) => $x !== null && $x >= 0))->isNotEmpty() ? round($v->avg(), 1) : null;

        return [
            'data' => $data->all(),
            'summary' => [
                'dispatches' => $data->count(),
                'avg_hours_to_approve' => $avg('hours_to_approve'),
                'avg_hours_to_deliver' => $avg('hours_to_deliver'),
            ],
        ];
    }

    public function getDeliverySuccessRate(array $filters = []): array
    {
        // Each count starts from a fresh query (they used to narrow one shared query in turn).
        $count = fn (?array $statuses = null) => $this->dispatchesInPeriod($filters)
            ->when($statuses, fn ($q) => $q->whereIn('order_dispatches.status', $statuses))->count();

        $total = $count();
        $delivered = $count(['delivered']);
        $cancelled = $count(['cancelled', 'rejected']);

        return [
            'total_dispatches' => $total,
            'delivered' => $delivered,
            'in_transit' => $count(['in_transit']),
            'awaiting_dispatch' => $count(['approved']),
            'pending' => $count(['pending', 'draft']),
            'failed_or_returned' => $count(['returned', 'failed']),
            'cancelled' => $cancelled,
            // Of the dispatches that went ahead (not cancelled / rejected), how many arrived.
            'delivery_rate' => ($total - $cancelled) > 0 ? round($delivered / ($total - $cancelled) * 100, 1) : 0,
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
     * Every customer with their orders and invoices: count, value, paid, balance and last order.
     * Customers with none are listed too, at 0. Cancelled orders and cancelled/void invoices,
     * proformas and credit notes are left out; draft invoices count, as in the sales reports.
     * Optional date_from / date_to limit the orders and invoices counted, not the customers.
     */
    public function getCustomerStats(array $filters = []): array
    {
        $from = $filters['date_from'] ?? null;
        $to = $filters['date_to'] ?? null;

        $orders = DB::table('orders')->where('company_id', $this->companyId)->whereNull('deleted_at')
            ->where('status', '!=', 'cancelled')
            ->when($from, fn ($q) => $q->whereRaw('coalesce(order_date, created_at)::date >= ?', [$from]))
            ->when($to, fn ($q) => $q->whereRaw('coalesce(order_date, created_at)::date <= ?', [$to]))
            ->groupBy('customer_id')
            ->selectRaw('customer_id, count(*) as orders, sum(coalesce(final_amount, total_amount)) as order_value, max(coalesce(order_date, created_at)) as last_order');

        $invoices = DB::table('invoices')->where('company_id', $this->companyId)
            ->whereNotIn('status', ['cancelled', 'void', 'voided'])
            ->where(fn ($q) => $q->whereNull('type')->orWhereNotIn('type', ['proforma', 'credit_note']))
            ->when($from, fn ($q) => $q->whereDate('invoice_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('invoice_date', '<=', $to))
            ->groupBy('customer_id')
            ->selectRaw('customer_id, count(*) as invoices, sum(total_amount) as invoiced, sum(amount_paid) as paid, sum(balance_amount) as balance');

        $rows = DB::table('customers as c')
            ->leftJoinSub($orders, 'o', 'o.customer_id', '=', 'c.id')
            ->leftJoinSub($invoices, 'i', 'i.customer_id', '=', 'c.id')
            ->where('c.company_id', $this->companyId)->whereNull('c.deleted_at')
            ->selectRaw("c.id as customer_id, coalesce(nullif(trim(c.business_name), ''), c.name) as customer, c.customer_number, c.phone,
                coalesce(o.orders, 0) as orders, coalesce(o.order_value, 0) as order_value, o.last_order,
                coalesce(i.invoices, 0) as invoices, coalesce(i.invoiced, 0) as invoiced, coalesce(i.paid, 0) as paid, coalesce(i.balance, 0) as balance")
            ->orderByDesc('order_value')->orderBy('customer')
            ->get()
            ->map(fn ($r) => [
                'customer_id' => $r->customer_id,
                'customer' => $r->customer,
                'customer_number' => $r->customer_number,
                'phone' => $r->phone,
                'orders' => (int) $r->orders,
                'order_value' => round((float) $r->order_value, 2),
                'invoices' => (int) $r->invoices,
                'invoiced' => round((float) $r->invoiced, 2),
                'paid' => round((float) $r->paid, 2),
                'balance' => round((float) $r->balance, 2),
                'last_order_date' => $r->last_order ? substr((string) $r->last_order, 0, 10) : null,
            ]);

        return [
            'rows' => $rows->values()->all(),
            'summary' => [
                'customers' => $rows->count(),
                'with_orders' => $rows->where('orders', '>', 0)->count(),
                'without_orders' => $rows->where('orders', 0)->count(),
                'orders' => $rows->sum('orders'),
                'order_value' => round($rows->sum('order_value'), 2),
                'invoiced' => round($rows->sum('invoiced'), 2),
                'paid' => round($rows->sum('paid'), 2),
                'balance' => round($rows->sum('balance'), 2),
            ],
        ];
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
            // order_date carries a time, so "to the 24th" means before the 25th.
            $query->where($table . '.order_date', '<', \Carbon\Carbon::parse($filters['date_to'])->addDay()->toDateString());
        }
        if (isset($filters['customer_id'])) {
            $query->where($table . '.customer_id', $filters['customer_id']);
        }
        if (!empty($filters['sales_rep_id'])) {
            $filters['sales_rep_id'] === 'unassigned'
                ? $query->whereNull($table . '.sales_rep_id')
                : $query->where($table . '.sales_rep_id', $filters['sales_rep_id']);
        }
        // Where the customer is: region, county or town (from the customer record, which every
        // order has - delivery locations are rarely filled in).
        foreach (['region' => 'region', 'county' => 'county', 'city' => 'city'] as $filter => $column) {
            if (!empty($filters[$filter])) {
                $query->whereIn($table . '.customer_id', DB::table('customers')
                    ->where('company_id', $this->companyId)
                    ->whereRaw("LOWER(TRIM({$column})) = ?", [mb_strtolower(trim($filters[$filter]))])
                    ->select('id'));
            }
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
        // A credit note belongs to the rep of the order its invoice came from.
        if (!empty($filters['sales_rep_id'])) {
            $orders = DB::table('orders')->where('company_id', $this->companyId);
            $filters['sales_rep_id'] === 'unassigned'
                ? $orders->whereNull('sales_rep_id')
                : $orders->where('sales_rep_id', $filters['sales_rep_id']);
            $query->whereIn('invoice_id', DB::table('invoices')->whereIn('order_id', $orders->select('id'))->select('id'));
        }
        // Same customer location filters as the orders they're netted against. (The order
        // "status" filter isn't applied: credit note statuses are a different set.)
        foreach (['region', 'county', 'city'] as $column) {
            if (!empty($filters[$column])) {
                $query->whereIn('customer_id', DB::table('customers')
                    ->where('company_id', $this->companyId)
                    ->whereRaw("LOWER(TRIM({$column})) = ?", [mb_strtolower(trim($filters[$column]))])
                    ->select('id'));
            }
        }
    }
}
