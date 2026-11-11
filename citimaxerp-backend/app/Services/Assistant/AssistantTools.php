<?php

namespace App\Services\Assistant;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The live data the assistant can look up, each read gated by the same permissions as the screen
 * that shows it and limited to the user's company. Results are small JSON-able arrays.
 */
class AssistantTools
{
    // Any one of these opens a tool.
    protected const ACCESS = [
        'how_to' => ['*'],
        'search_products' => ['can_view_inventory_menu', 'can_view_sales_menu', 'can_view_pos_menu', 'can_create_orders', 'can_view_quotes_menu'],
        'match_products' => ['can_view_inventory_menu', 'can_view_sales_menu', 'can_view_pos_menu', 'can_create_orders', 'can_view_quotes_menu'],
        'stock_on_hand' => ['can_view_inventory_menu', 'can_view_sales_menu', 'can_view_pos_menu', 'can_create_orders', 'can_view_quotes_menu'],
        'stock_alerts' => ['can_view_inventory_menu'],
        'stock_history' => ['can_view_inventory_menu', 'can_view_reports_menu'],
        'list_invoices' => ['can_view_sales_menu'],
        'list_bounced_debits' => ['can_view_sales_menu'],
        'list_orders' => ['can_view_sales_menu'],
        'sales_summary' => ['can_view_sales_menu', 'can_view_reports_menu'],
        'customer_account' => ['can_view_customers_menu', 'can_view_sales_menu'],
        'customer_stats' => ['can_view_reports_menu', 'can_view_customers_menu', 'can_view_sales_menu'],
        'receipts_summary' => ['can_view_payments_menu'],
        'expenses_summary' => ['can_view_expenses_menu', 'can_view_finance_menu'],
        'purchase_orders' => ['can_view_purchase_orders_menu'],
    ];

    // Invoices that do not count as sales. Drafts do count: most invoices here stay "draft" after
    // their order is approved, and the sales reports include them.
    protected const DEAD_INVOICE = ['cancelled', 'void', 'voided'];

    protected string $companyId;

    public function __construct(protected User $user)
    {
        $this->companyId = $user->company_id;
    }

    public function can(string $permission): bool
    {
        $role = $this->user->role;
        if (!$role) {
            return false;
        }
        return $role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company') || $role->hasPermission($permission);
    }

    public function allowed(string $tool): bool
    {
        return collect(self::ACCESS[$tool] ?? [])->contains(fn ($p) => $p === '*' || $this->can($p));
    }

    /** Tool definitions (OpenAI/Groq function format) for the tools this user may call. */
    public function definitions(): array
    {
        $range = [
            'date_from' => ['type' => 'string', 'description' => 'Start date YYYY-MM-DD (default: first day of this month)'],
            'date_to' => ['type' => 'string', 'description' => 'End date YYYY-MM-DD (default: today)'],
        ];
        $all = [
            'how_to' => ['Steps for doing something in the system (adding products, making orders, receiving goods, reports, payroll...) and where it is.', [
                'topic' => ['type' => 'string', 'description' => 'What the user wants to do, e.g. "add a product", "sales report"'],
            ], ['topic']],
            'search_products' => ['Find products by description or price-list code (e.g. "amoxyclav", "NSPD 001"). Returns prices per price list with codes, stock on hand and nearest expiry.', [
                'query' => ['type' => 'string', 'description' => 'Words of the description, or a price-list code'],
                'limit' => ['type' => 'integer', 'description' => 'Max products (default 8, max 20)'],
            ], ['query']],
            'match_products' => ['Match a list of products (typed, pasted, from an attached file or a photo) to the system, line by line: item no., description, price-list codes and prices, stock. Use it whenever the user gives several products at once.', [
                'lines' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'One product per line as the user wrote it (description and/or code; quantities may be included)'],
            ], ['lines']],
            'stock_on_hand' => ['The whole stock list, as Inventory Reports > Stock Balance shows it (live, so goods just received are included): every line in stock and every line at 0, with totals and notes on expired stock and stock figures that disagree with their batches. Use it for "what stock do we have", "available stock", "stock list", "what is out of stock". The full table is shown to the user automatically.', [
                'search' => ['type' => 'string', 'description' => 'Optional words of the description to narrow it, e.g. "bandage"'],
            ], []],
            'stock_alerts' => ['Alerts only (not the stock list): products at or below their reorder level or out of stock, batches expiring soon, and expired batches still holding stock.', [
                'expiring_within_days' => ['type' => 'integer', 'description' => 'Batches expiring within this many days (default 90)'],
            ], []],
            'stock_history' => ['Where one item\'s stock went and came from in a period (Inventory Reports > Stock Movement for that item): each sale with its NSK invoice and customer, goods received with the supplier, credit-note returns, returns to supplier, adjustments and stock counts, with quantities and totals. Use it for "where did <item> go", "who bought <item>", "which invoices took <item>", "stock history of <item>".', $range + [
                'query' => ['type' => 'string', 'description' => 'Words of the item description, e.g. "10 ml syringe with needle"'],
                'direction' => ['type' => 'string', 'enum' => ['all', 'out', 'in'], 'description' => 'out = where it went, in = where it came from. Default all'],
            ], ['query']],
            'list_bounced_debits' => ['Bounced cheque debits (DEB-001, DEB-002...), the KES 2,000 charge on each bounced customer cheque, earliest first, with the cheque, what was paid and the balance. Use for bounced cheques, DEB numbers and what customers owe on them.', [
                'search' => ['type' => 'string', 'description' => 'Debit number (DEB-001), cheque number or customer name'],
                'status' => ['type' => 'string', 'enum' => ['any', 'unpaid', 'paid'], 'description' => 'Default any'],
                'limit' => ['type' => 'integer', 'description' => 'Max debits (default 25, max 100)'],
            ], []],
            'list_invoices' => ['Sales invoices, newest first, plus latest_nsk (the highest NSK number issued). Use for "latest invoice number" (answer with latest_nsk), an invoice number (NSK/0427), a customer\'s invoices, or unpaid/overdue invoices.', $range + [
                'search' => ['type' => 'string', 'description' => 'Invoice number (NSK/0427, 427) or customer name'],
                'status' => ['type' => 'string', 'enum' => ['any', 'unpaid', 'overdue', 'paid'], 'description' => 'Default any'],
                'limit' => ['type' => 'integer', 'description' => 'Max invoices (default 5, max 25)'],
            ], []],
            'list_orders' => ['Sales orders, newest first, optionally for a customer or status.', $range + [
                'search' => ['type' => 'string', 'description' => 'Order number or customer name'],
                'limit' => ['type' => 'integer', 'description' => 'Max orders (default 5, max 25)'],
            ], []],
            'sales_summary' => ['Sales for a period, overall or for one customer: invoiced, paid, credited, outstanding, invoice count, order totals, top customers and top products. Use it for "sales report for <customer>".', $range + [
                'customer' => ['type' => 'string', 'description' => 'Optional customer or business name to limit to'],
            ], []],
            'customer_account' => ['A customer\'s account: what they owe, overdue amount, open invoices and last payment.', [
                'query' => ['type' => 'string', 'description' => 'Customer or business name'],
            ], ['query']],
            'customer_stats' => ['Every customer with their number of orders, order value, invoices, invoiced, paid and balance, and last order date (CRM Reports > Customer Stats). Customers with no orders are included at 0. Use it for "how many orders has <customer> made", "customers with no orders", "best customers", "customer stats". All time unless dates are given. The full table is shown to the user automatically.', [
                'date_from' => ['type' => 'string', 'description' => 'Optional start date YYYY-MM-DD (default: all time)'],
                'date_to' => ['type' => 'string', 'description' => 'Optional end date YYYY-MM-DD (default: all time)'],
                'search' => ['type' => 'string', 'description' => 'Optional customer name to narrow it'],
                'only' => ['type' => 'string', 'enum' => ['all', 'with_orders', 'without_orders'], 'description' => 'Default all'],
                'sort' => ['type' => 'string', 'enum' => ['order_value', 'orders', 'balance', 'name'], 'description' => 'Default order_value (highest first)'],
            ], []],
            'receipts_summary' => ['Money received from customers in a period: total, by payment method, latest receipts.', $range, []],
            'expenses_summary' => ['Expenses (expenditure) in a period: total, by category and status, latest expenses.', $range + [
                'category' => ['type' => 'string', 'description' => 'Optional category name'],
            ], []],
            'purchase_orders' => ['Purchase orders, newest first, with supplier, total, approval, receipt and payment status.', [
                'status' => ['type' => 'string', 'description' => 'Optional: pending, partial, received, cancelled'],
                'limit' => ['type' => 'integer', 'description' => 'Max (default 8, max 25)'],
            ], []],
        ];

        $defs = [];
        foreach ($all as $name => [$description, $properties, $required]) {
            if (!$this->allowed($name)) {
                continue;
            }
            $defs[] = ['type' => 'function', 'function' => [
                'name' => $name,
                'description' => $description,
                'parameters' => ['type' => 'object', 'properties' => (object) $properties, 'required' => $required],
            ]];
        }
        return $defs;
    }

    public function run(string $tool, array $args): array
    {
        if (!isset(self::ACCESS[$tool]) || !method_exists($this, $tool)) {
            return ['error' => "Unknown tool {$tool}"];
        }
        if (!$this->allowed($tool)) {
            return ['error' => 'The user does not have access to this information.'];
        }
        // Read only, enforced by the database: each lookup runs in a READ ONLY transaction that is
        // rolled back, so nothing the assistant does can change data.
        DB::beginTransaction();
        try {
            DB::statement('SET TRANSACTION READ ONLY');
            return $this->{$tool}($args);
        } catch (\Throwable $e) {
            report($e);
            return ['error' => 'Could not read this data right now.'];
        } finally {
            DB::rollBack();
        }
    }

    // ---------------------------------------------------------------- helpers

    protected function range(array $args): array
    {
        $tz = 'Africa/Nairobi';
        $from = !empty($args['date_from']) ? Carbon::parse($args['date_from'], $tz) : now($tz)->startOfMonth();
        $to = !empty($args['date_to']) ? Carbon::parse($args['date_to'], $tz) : now($tz);
        return [$from->toDateString(), $to->toDateString()];
    }

    protected function limit(array $args, int $default, int $max): int
    {
        return max(1, min($max, (int) ($args['limit'] ?? $default)));
    }

    protected static function money($v): float
    {
        return round((float) $v, 2);
    }

    protected static function customerName($c): string
    {
        return $c ? (trim((string) ($c->business_name ?: $c->name)) ?: 'Unknown') : 'Unknown';
    }

    protected function liveInvoices()
    {
        // Columns qualified: summaries join customers, which has its own company_id and status.
        return Invoice::where('invoices.company_id', $this->companyId)
            ->whereNotIn('invoices.status', self::DEAD_INVOICE)
            ->where(fn ($q) => $q->whereNull('invoices.type')->orWhereNotIn('invoices.type', ['proforma', 'credit_note']));
    }

    /** Customers whose name, business name or number contains every word typed, in any order. */
    protected function matchingCustomers(string $term)
    {
        $words = collect(preg_split('/\s+/', trim($term)))->filter(fn ($w) => strlen($w) > 1);
        if ($words->isEmpty()) {
            return collect();
        }
        $q = Customer::where('company_id', $this->companyId);
        foreach ($words as $w) {
            $q->where(fn ($c) => $c->where('name', 'ilike', "%{$w}%")->orWhere('business_name', 'ilike', "%{$w}%")
                ->orWhere('customer_number', 'ilike', "%{$w}%"));
        }
        return $q->limit(25)->get(['id', 'name', 'business_name', 'customer_number', 'phone', 'payment_method']);
    }

    protected function suggestCustomers(string $term): array
    {
        return $this->suggest('customers', ['business_name', 'name'], $term);
    }

    /**
     * Close matches for a name that found nothing: names sharing the first letters of any word typed
     * (so "sarra chemist" offers "Sarara Chemist Limited"), best first.
     */
    protected function suggest(string $table, array $columns, string $term): array
    {
        $stems = collect(preg_split('/[^a-z0-9]+/i', strtolower($term)))->filter(fn ($w) => strlen($w) >= 3)
            ->map(fn ($w) => substr($w, 0, 3))->unique()->values();
        if ($stems->isEmpty()) {
            return [];
        }
        $label = count($columns) > 1 ? "coalesce(nullif(trim({$columns[0]}), ''), {$columns[1]})" : $columns[0];
        $hits = DB::table($table)->where('company_id', $this->companyId)->whereNull('deleted_at')
            ->where(function ($q) use ($stems, $columns) {
                foreach ($stems as $s) {
                    foreach ($columns as $c) {
                        $q->orWhere($c, 'ilike', "%{$s}%");
                    }
                }
            })
            ->selectRaw("distinct {$label} as label")->limit(80)->pluck('label');
        return $hits->sortByDesc(fn ($l) => $stems->filter(fn ($s) => str_contains(strtolower((string) $l), $s))->count())
            ->take(5)->values()->all();
    }

    protected function canSeeCost(): bool
    {
        return $this->can('can_create_products') || $this->can('can_view_finance_menu') || $this->can('can_view_purchase_orders_menu');
    }

    // ---------------------------------------------------------------- tools

    protected function how_to(array $args): array
    {
        return AssistantKnowledge::howTo(fn ($p) => $this->can($p), (string) ($args['topic'] ?? ''));
    }

    protected function search_products(array $args): array
    {
        $term = trim((string) ($args['query'] ?? ''));
        $compact = strtoupper(preg_replace('/[\s\-]+/', '', $term));
        $products = Product::where('company_id', $this->companyId)
            ->where(function ($q) use ($term, $compact) {
                $q->where('name', 'ilike', '%' . $term . '%');
                if (ctype_digit($term)) {
                    $q->orWhere('item_number', (int) $term);
                }
                // A code is its list and number, "NSPD 001"; typed with or without the space.
                $q->orWhereIn('id', DB::table('product_price_tiers')->where('company_id', $this->companyId)
                    ->whereRaw("upper(replace(tier_name || coalesce(item_code, ''), ' ', '')) like ?", ['%' . $compact . '%'])->select('product_id'));
            })
            ->with(['priceTiers', 'variants'])
            ->orderBy('item_number')
            ->limit($this->limit($args, 8, 20))
            ->get();

        if ($products->isEmpty()) {
            return ['products' => [], 'did_you_mean' => $this->suggest('products', ['name'], $term)];
        }

        $stock = DB::table('inventory_batches')->where('company_id', $this->companyId)
            ->whereIn('product_id', $products->pluck('id'))
            ->groupBy('product_id')
            ->selectRaw("product_id, sum(quantity_available) as qty, min(case when quantity_available > 0 then expiry_date end) as nearest_expiry")
            ->get()->keyBy('product_id');

        return ['products' => $products->map(function (Product $p) use ($stock) {
            $row = [
                'description' => $p->name,
                'unit' => $p->unit_of_measurement,
                'active' => (bool) $p->is_active,
                'tax' => $p->is_taxable === false ? 'Exempt' : ((float) $p->tax_rate > 0 ? 'VAT ' . (float) $p->tax_rate . '%' : 'Zero rated'),
                'default_price' => self::money($p->price),
                'prices' => $p->priceTiers->map(fn ($t) => ['list' => $t->tier_name, 'code' => trim($t->tier_name . ' ' . $t->item_code), 'price' => self::money($t->price)])->values(),
                'sizes' => $p->variants->map(fn ($v) => ['size' => $v->name, 'price' => self::money($v->price)])->values(),
                'stock_on_hand' => (float) ($stock[$p->id]->qty ?? 0),
                'nearest_expiry' => $stock[$p->id]->nearest_expiry ?? null,
                'reorder_level' => $p->low_stock_threshold,
            ];
            if ($this->canSeeCost()) {
                $row['cost_price'] = self::money($p->unit_cost);
            }
            return $row;
        })->values()];
    }

    /**
     * Each line of a list matched to one product: by its price-list code when it has one
     * ("NSPD 001", "nspv-3"), otherwise by the words of its description (all of them, or else the
     * product sharing the most). Quantities and pack words in the line are ignored.
     */
    protected function match_products(array $args): array
    {
        $lines = collect($args['lines'] ?? [])->map(fn ($l) => trim((string) $l))->filter()->take(40)->values();
        $stock = fn ($ids) => DB::table('inventory_batches')->where('company_id', $this->companyId)->whereIn('product_id', $ids)
            ->groupBy('product_id')->selectRaw('product_id, sum(quantity_available) as qty')->pluck('qty', 'product_id');
        $describe = function (Product $p, $qty) {
            return [
                'description' => $p->name,
                'codes' => $p->priceTiers->map(fn ($t) => trim($t->tier_name . ' ' . $t->item_code) . ' = ' . number_format((float) $t->price, 2))->implode('; ') ?: 'none',
                'stock' => (float) $qty,
            ];
        };

        $results = [];
        foreach ($lines as $line) {
            $match = null;
            $how = null;
            $alternatives = [];

            if (preg_match('/\b(NSP[A-Z])\s*[-\/]?\s*(\d{1,5})\b/i', $line, $m)) {
                $match = Product::where('company_id', $this->companyId)->whereHas('priceTiers', fn ($t) => $t
                    ->whereRaw('upper(tier_name) = ?', [strtoupper($m[1])])
                    ->whereRaw("ltrim(coalesce(item_code, ''), '0') = ?", [ltrim($m[2], '0')]))->with('priceTiers')->first();
                $how = $match ? 'code' : null;
            }

            if (!$match) {
                // Words that identify a product: names and strengths ("amoxyclav", "375mg"), not
                // quantities, pack words or a stray code.
                $noise = ['pcs', 'pc', 'pack', 'packs', 'box', 'boxes', 'tabs', 'tablets', 'tablet', 'of', 'and', 'the', 'qty', 'nos', 'units', 'unit', 'each', 'per'];
                $words = collect(preg_split('/[^a-z0-9.]+/i', strtolower($line)))
                    ->filter(fn ($w) => strlen($w) >= 3 && preg_match('/[a-z]/', $w) && !in_array($w, $noise, true) && !preg_match('/^nsp[a-z]$/', $w))
                    ->unique()->values();
                if ($words->isNotEmpty()) {
                    // Compared without spaces: "2ml" and "23g" match "2 Ml" and "23 G".
                    $all = Product::where('company_id', $this->companyId)->where('is_active', true);
                    foreach ($words as $w) {
                        $all->whereRaw("replace(lower(name), ' ', '') like ?", ['%' . $w . '%']);
                    }
                    $found = $all->with('priceTiers')->orderByRaw('length(name)')->limit(3)->get();
                    if ($found->isNotEmpty()) {
                        $match = $found->first();
                        $how = 'name';
                        $alternatives = $found->slice(1)->pluck('name')->values()->all();
                    } else {
                        // Best partial (typos, extra words): name words count double a strength like
                        // "500mg", the first word (usually the drug) counts most, compared on the
                        // first 4 letters of each word.
                        $terms = $words->values()->map(fn ($w, $i) => [
                            'stem' => ctype_alpha($w) ? substr($w, 0, 4) : $w,
                            'weight' => (ctype_alpha($w) ? 2 : 1) + ($i === 0 ? 2 : 0),
                        ]);
                        $possible = $terms->sum('weight');
                        $candidates = Product::where('company_id', $this->companyId)->where('is_active', true)
                            ->where(fn ($q) => $terms->each(fn ($s) => $q->orWhereRaw("replace(lower(name), ' ', '') like ?", ['%' . $s['stem'] . '%'])))
                            ->with('priceTiers')->limit(300)->get()
                            ->map(function ($p) use ($terms, $line) {
                                $name = str_replace(' ', '', strtolower($p->name));
                                // Ties go to the name most like the whole line ("...1gm pack of 10" -> "1gm-10's").
                                similar_text(str_replace(' ', '', strtolower($line)), $name, $likeness);
                                return ['p' => $p, 'score' => $terms->filter(fn ($s) => str_contains($name, $s['stem']))->sum('weight'), 'like' => $likeness];
                            })
                            ->sort(fn ($a, $b) => [$b['score'], $b['like']] <=> [$a['score'], $a['like']])->values();
                        $best = $candidates->first();
                        if ($best && $best['score'] * 2 >= $possible) {
                            $match = $best['p'];
                            $how = 'partial';
                        }
                        $alternatives = $candidates->slice($match ? 1 : 0, 3)->pluck('p.name')->values()->all();
                    }
                }
            }

            $results[] = ['line' => $line, 'matched_by' => $how, 'product' => $match, 'alternatives' => $alternatives];
        }

        $qty = $stock(collect($results)->pluck('product')->filter()->pluck('id'));
        return ['matches' => collect($results)->map(fn ($r) => [
            'line' => $r['line'],
            'matched_by' => $r['matched_by'] ?? 'no match',
            'product' => $r['product'] ? $describe($r['product'], $qty[$r['product']->id] ?? 0) : null,
            'did_you_mean' => $r['alternatives'],
        ])->all()];
    }

    /**
     * The whole stock list, line for line as Inventory Reports > Stock Balance shows it (each size
     * its own line), so the answer and the screen agree: what is in stock, and what is at 0. From
     * the batches it adds what has passed its expiry or has a mistyped expiry (year 0029), and
     * lines whose batches do not add up to the stock shown. Read live on every call.
     *
     * The full tables are not given to the model (too long for it); they go in "_table", which
     * AssistantService adds under the answer as they are.
     */
    protected function stock_on_hand(array $args): array
    {
        $tz = 'Africa/Nairobi';
        $today = now($tz)->toDateString();
        $words = collect(preg_split('/\s+/', strtolower(trim((string) ($args['search'] ?? '')))))->filter(fn ($w) => strlen($w) > 1);

        $lines = collect(app(\App\Services\ReportService::class)->forCompany($this->companyId)->getStockBalanceReport()['data'])
            ->where('row_type', '!=', 'parent')
            ->filter(fn ($r) => $words->every(fn ($w) => str_contains(strtolower($r['name']), $w)))
            ->sortBy(fn ($r) => strtolower($r['name']))->values();

        // Batches by line: a size by its own batches, an item without sizes by all of its batches.
        $batches = DB::table('inventory_batches')->where('company_id', $this->companyId)->where('quantity_available', '>', 0)
            ->whereIn('product_id', $lines->pluck('product_id')->unique())
            ->selectRaw("product_id, variant_id, sum(quantity_available) as qty,
                sum(case when expiry_date >= '2000-01-01' and expiry_date < ? then quantity_available else 0 end) as expired,
                sum(case when expiry_date < '2000-01-01' then quantity_available else 0 end) as bad_date,
                min(case when expiry_date >= ? then expiry_date end) as nearest_expiry", [$today, $today])
            ->groupBy('product_id', 'variant_id')->get();
        $batchesOf = fn ($r) => $batches->where('product_id', $r['product_id'])
            ->filter(fn ($b) => $r['variant_id'] === null || $b->variant_id === $r['variant_id']);

        $inStock = collect();
        $atZero = collect();
        $notes = ['expired' => [], 'wrong_expiry_date' => [], 'batches_do_not_match_stock' => []];
        foreach ($lines as $r) {
            $b = $batchesOf($r);
            $stock = (float) $r['stock_quantity'];
            $expired = (float) $b->sum('expired');
            $badDate = (float) $b->sum('bad_date');
            $name = str_replace('|', '/', $r['name']);
            if ($expired > 0) {
                $notes['expired'][] = "{$name}: " . number_format($expired);
            }
            if ($badDate > 0) {
                $notes['wrong_expiry_date'][] = "{$name}: " . number_format($badDate);
            }
            if (abs((float) $b->sum('qty') - $stock) > 0.001) {
                $notes['batches_do_not_match_stock'][] = "{$name}: shows " . number_format($stock) . ', batches hold ' . number_format((float) $b->sum('qty'));
            }
            if ($stock > 0) {
                $expiry = $b->pluck('nearest_expiry')->filter()->min();
                $inStock->push([$name, $stock, max(0, $stock - $expired - $badDate), $expiry ? Carbon::parse($expiry)->format('d/m/Y') : '-']);
            } elseif ($r['is_active']) {
                // A hidden (inactive) product at 0 is not stock that ran out.
                $atZero->push($name);
            }
        }

        $table = '';
        if ($inStock->isNotEmpty()) {
            $table .= "**In stock ({$inStock->count()})**\n\n| S/No | Description | Stock | Usable | Nearest expiry |\n|---|---|---|---|---|\n"
                . $inStock->values()->map(fn ($l, $i) => '| ' . ($i + 1) . " | {$l[0]} | " . number_format($l[1]) . ' | ' . number_format($l[2]) . " | {$l[3]} |")->implode("\n");
        }
        if ($atZero->isNotEmpty()) {
            $table .= "\n\n**Out of stock - 0 ({$atZero->count()})**\n\n| S/No | Description | Stock |\n|---|---|---|\n"
                . $atZero->values()->map(fn ($n, $i) => '| ' . ($i + 1) . " | {$n} | 0 |")->implode("\n");
        }

        return [
            'as_of' => now($tz)->format('d/m/Y H:i'),
            'lines_in_stock' => $inStock->count(),
            'lines_out_of_stock' => $atZero->count(),
            'total_units_in_stock' => (float) $inStock->sum(1),
            'usable_units' => (float) $inStock->sum(2),
            'notes' => collect($notes)->filter()->map(fn ($n) => count($n) > 15
                ? array_merge(array_slice($n, 0, 15), ['and ' . (count($n) - 15) . ' more'])
                : $n)->all(),
            'full_list_link' => '[Inventory Reports > Stock Balance](/reports/inventory)',
            'table_shown_to_user' => $table !== '' ? 'The full table of every line is added under your answer automatically.' : 'Nothing matched.',
            '_table' => $table,
        ];
    }

    /**
     * One item's stock movements in a period, each with its document (NSK invoice, credit note, goods
     * received ...) and customer or supplier, as Inventory Reports > Stock Movement shows them.
     */
    protected function stock_history(array $args): array
    {
        $words = collect(preg_split('/\s+/', trim((string) ($args['query'] ?? ''))))->filter(fn ($w) => strlen($w) > 1);
        if ($words->isEmpty()) {
            return ['error' => 'Say which item.'];
        }
        $q = Product::where('company_id', $this->companyId);
        foreach ($words as $w) {
            $q->where('name', 'ilike', "%{$w}%");
        }
        $products = $q->orderByRaw('length(name)')->limit(10)->get(['id', 'name']);
        if ($products->isEmpty()) {
            return ['found' => false, 'did_you_mean' => $this->suggest('products', ['name'], (string) $args['query'])];
        }
        $product = $products->first();
        [$from, $to] = $this->range($args);
        $direction = in_array($args['direction'] ?? '', ['in', 'out'], true) ? $args['direction'] : null;

        $rows = collect(app(\App\Services\ReportService::class)->forCompany($this->companyId)->getInventoryMovementLog(array_filter([
            'product_id' => $product->id,
            'date_from' => $from,
            'date_to' => $to,
            'direction' => $direction,
        ]))['data']);

        $table = $rows->isEmpty() ? '' : "| S/No | Date | Item | Type | In | Out | Reference | Customer / Supplier |\n|---|---|---|---|---|---|---|---|\n"
            . $rows->take(60)->values()->map(fn ($r, $i) => '| ' . ($i + 1) . ' | ' . Carbon::parse($r['movement_date'])->format('d/m/Y')
                . ' | ' . str_replace('|', '/', $r['name']) . ' | ' . str_replace('_', ' ', $r['type'])
                . ' | ' . ($r['direction'] === 'in' ? number_format($r['quantity']) : '') . ' | ' . ($r['direction'] === 'out' ? number_format($r['quantity']) : '')
                . ' | ' . trim(($r['reference_type'] ?? '') . ' ' . ($r['reference_number'] ?? '')) . ' | ' . str_replace('|', '/', (string) ($r['party'] ?? '-')) . ' |')->implode("\n")
            . ($rows->count() > 60 ? "\n\n" . ($rows->count() - 60) . ' more in Inventory Reports > Stock Movement.' : '');

        $sales = $rows->where('direction', 'out')->filter(fn ($r) => in_array($r['reference_type'], ['Invoice', 'Order'], true));
        return [
            'item' => $product->name,
            'other_matches' => $products->skip(1)->pluck('name')->values()->all(),
            'period' => Carbon::parse($from)->format('d/m/Y') . ' to ' . Carbon::parse($to)->format('d/m/Y'),
            'movements' => $rows->count(),
            'units_in' => $rows->where('direction', 'in')->sum('quantity'),
            'units_out' => $rows->where('direction', 'out')->sum('quantity'),
            'sold_by_customer' => $sales->groupBy(fn ($r) => $r['party'] ?? 'Unknown')
                ->map(fn ($g, $c) => ['customer' => $c, 'units' => $g->sum('quantity'), 'invoices' => $g->pluck('reference_number')->unique()->values()->all()])
                ->sortByDesc('units')->take(15)->values()->all(),
            'full_history_link' => '[Inventory Reports > Stock Movement](/reports/inventory?tab=movement&product_id=' . $product->id
                . '&name=' . rawurlencode($product->name) . "&from={$from}&to={$to})",
            'table_shown_to_user' => $table !== '' ? 'The table of movements is added under your answer automatically.' : 'No stock moved for this item in the period.',
            '_table' => $table,
        ];
    }

    protected function stock_alerts(array $args): array
    {
        $days = max(1, min(365, (int) ($args['expiring_within_days'] ?? 90)));
        $stock = DB::table('products as p')
            ->leftJoin('inventory_batches as b', 'b.product_id', '=', 'p.id')
            ->where('p.company_id', $this->companyId)->where('p.is_active', true)->whereNull('p.deleted_at')
            ->groupBy('p.id', 'p.name', 'p.item_number', 'p.low_stock_threshold')
            ->selectRaw('p.item_number, p.name, p.low_stock_threshold, coalesce(sum(b.quantity_available), 0) as qty')
            ->havingRaw('coalesce(sum(b.quantity_available), 0) <= coalesce(p.low_stock_threshold, 0)')
            ->orderBy('qty')->limit(40)->get();

        $batches = fn () => DB::table('inventory_batches as b')->join('products as p', 'p.id', '=', 'b.product_id')
            ->where('b.company_id', $this->companyId)->where('b.quantity_available', '>', 0)->whereNotNull('b.expiry_date')
            ->orderBy('b.expiry_date')->limit(40);
        $cols = ['p.item_number', 'p.name', 'b.batch_number', 'b.expiry_date', 'b.quantity_available'];
        $today = now('Africa/Nairobi')->toDateString();
        $batchRow = fn ($r) => ['description' => $r->name, 'batch' => $r->batch_number, 'quantity' => (float) $r->quantity_available]
            // A year like 0029 is a typing slip, not an expired batch.
            + (substr((string) $r->expiry_date, 0, 4) < '2000'
                ? ['expiry' => 'wrong date entered (' . substr((string) $r->expiry_date, 0, 10) . ') - correct it on the batch']
                : ['expiry' => substr((string) $r->expiry_date, 0, 10)]);

        return [
            'note' => 'Only alerts. For all stock available, use stock_on_hand.',
            'low_or_out_of_stock' => $stock->map(fn ($r) => ['description' => $r->name, 'stock' => (float) $r->qty, 'reorder_level' => $r->low_stock_threshold]),
            'expiring_within_days' => $days,
            'expiring_batches' => $batches()->whereDate('b.expiry_date', '>=', $today)
                ->whereDate('b.expiry_date', '<=', now('Africa/Nairobi')->addDays($days)->toDateString())->get($cols)->map($batchRow),
            // Still holding stock after their expiry date: to be written off or returned.
            'expired_with_stock' => $batches()->whereDate('b.expiry_date', '<', $today)->get($cols)->map($batchRow),
        ];
    }

    protected function list_invoices(array $args): array
    {
        $q = $this->liveInvoices()->with('customer:id,name,business_name');
        $search = trim((string) ($args['search'] ?? ''));
        if ($search !== '') {
            $q->where(function ($w) use ($search) {
                $w->whereNumberMatches($search)
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'ilike', "%{$search}%")->orWhere('business_name', 'ilike', "%{$search}%"));
            });
        }
        if (!empty($args['date_from']) || !empty($args['date_to'])) {
            [$from, $to] = $this->range($args);
            $q->whereBetween('invoice_date', [$from, $to]);
        }
        $status = $args['status'] ?? 'any';
        if ($status === 'unpaid') {
            $q->where('balance_amount', '>', 0.005);
        } elseif ($status === 'overdue') {
            $q->where('balance_amount', '>', 0.005)->whereDate('due_date', '<', now());
        } elseif ($status === 'paid') {
            $q->where('balance_amount', '<=', 0.005);
        }

        $invoices = $q->orderByDesc('invoice_date')->orderByDesc('created_at')->limit($this->limit($args, 5, 25))->get();
        if ($invoices->isEmpty() && $search !== '' && !preg_match('/\d/', $search)) {
            return ['invoices' => [], 'did_you_mean' => $this->suggestCustomers($search)];
        }
        // The latest NSK number issued: the newest invoice by date may still have no File No
        // (it then shows as INV-0465), so "the latest invoice number" is the highest NSK one.
        $latest = $search !== '' ? null : $this->liveInvoices()->with('customer:id,name,business_name')
            ->whereRaw("invoices.file_number ~ '^[0-9]+$'")->orderByRaw('invoices.file_number::int desc')->first();

        return ['latest_nsk' => $latest ? [
            'number' => $latest->invoice_number,
            'date' => optional($latest->invoice_date)->toDateString(),
            'customer' => self::customerName($latest->customer),
            'total' => self::money($latest->total_amount),
        ] : null, 'invoices' => $invoices->map(fn (Invoice $i) => [
            'number' => $i->invoice_number,
            'has_nsk_number' => str_starts_with((string) $i->invoice_number, Invoice::LEGACY_PREFIX),
            'date' => optional($i->invoice_date)->toDateString(),
            'customer' => self::customerName($i->customer),
            'total' => self::money($i->total_amount),
            'paid' => self::money($i->amount_paid),
            'credited' => self::money($i->amount_credited),
            'balance' => self::money($i->balance_amount),
            'status' => $i->status,
            'due_date' => optional($i->due_date)->toDateString(),
            'payment_type' => $i->payment_type,
        ])->values()];
    }

    protected function list_bounced_debits(array $args): array
    {
        $search = trim((string) ($args['search'] ?? ''));
        $debits = \App\Models\Cheque::with(['customer:id,name,business_name', 'bounceChargeInvoice'])
            ->where('company_id', $this->companyId)
            ->where('direction', 'received')
            ->where('status', 'bounced')
            ->whereNotNull('bounce_charge_invoice_id')
            ->get()
            ->sortBy(fn ($c) => [(int) substr((string) $c->bounceChargeInvoice?->invoice_number, 4), (string) $c->id])
            ->filter(function ($c) use ($search, $args) {
                $balance = (float) $c->bounceChargeInvoice?->balance_amount;
                $status = $args['status'] ?? 'any';
                if (($status === 'unpaid' && $balance <= 0.005) || ($status === 'paid' && $balance > 0.005)) {
                    return false;
                }
                if ($search === '') {
                    return true;
                }
                $number = (int) preg_replace('/\D/', '', $search);
                return (preg_match('/^deb/i', $search) && (int) substr((string) $c->bounceChargeInvoice?->invoice_number, 4) === $number)
                    || stripos((string) $c->cheque_number, $search) !== false
                    || stripos((string) self::customerName($c->customer), $search) !== false;
            })
            ->values();

        return [
            'count' => $debits->count(),
            'total_balance' => self::money($debits->sum(fn ($c) => (float) $c->bounceChargeInvoice?->balance_amount)),
            'debits' => $debits->take($this->limit($args, 25, 100))->map(fn ($c) => [
                'number' => $c->bounceChargeInvoice?->invoice_number,
                'date' => optional($c->bounceChargeInvoice?->invoice_date)->toDateString(),
                'customer' => self::customerName($c->customer),
                'cheque_number' => $c->cheque_number,
                'bank' => $c->bank_name,
                'cheque_amount' => self::money($c->amount),
                'debit' => self::money($c->bounceChargeInvoice?->total_amount),
                'paid' => self::money($c->bounceChargeInvoice?->amount_paid),
                'balance' => self::money($c->bounceChargeInvoice?->balance_amount),
            ])->values(),
        ];
    }

    protected function list_orders(array $args): array
    {
        $q = Order::where('company_id', $this->companyId)->with(['customer:id,name,business_name', 'invoice:id,order_id,invoice_number,file_number']);
        $search = trim((string) ($args['search'] ?? ''));
        if ($search !== '') {
            $q->where(fn ($w) => $w->where('order_number', 'ilike', "%{$search}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'ilike', "%{$search}%")->orWhere('business_name', 'ilike', "%{$search}%")));
        }
        if (!empty($args['date_from']) || !empty($args['date_to'])) {
            [$from, $to] = $this->range($args);
            $q->whereBetween(DB::raw('coalesce(order_date, created_at::date)'), [$from, $to]);
        }
        $orders = $q->orderByDesc(DB::raw('coalesce(order_date, created_at::date)'))->orderByDesc('created_at')->limit($this->limit($args, 5, 25))->get();
        return ['orders' => $orders->map(fn (Order $o) => [
            'number' => $o->order_number,
            'date' => optional($o->order_date ?? $o->created_at)->toDateString(),
            'customer' => self::customerName($o->customer),
            'total' => self::money($o->final_amount ?: $o->total_amount),
            'status' => $o->status,
            'payment_status' => $o->payment_status,
            'invoice' => $o->invoice?->invoice_number,
        ])->values()];
    }

    protected function sales_summary(array $args): array
    {
        [$from, $to] = $this->range($args);
        $customerIds = null;
        if (!empty($args['customer'])) {
            $customerIds = $this->matchingCustomers((string) $args['customer'])->pluck('id');
            if ($customerIds->isEmpty()) {
                return ['error' => 'No customer matches "' . $args['customer'] . '".', 'did_you_mean' => $this->suggestCustomers((string) $args['customer'])];
            }
        }
        $base = fn () => $this->liveInvoices()->whereBetween('invoices.invoice_date', [$from, $to])
            ->when($customerIds, fn ($q) => $q->whereIn('invoices.customer_id', $customerIds));
        // Order totals by order date, excluding cancelled orders: the dashboard's "Sales" figure.
        $ordersTotal = Order::where('company_id', $this->companyId)->where('status', '!=', 'cancelled')
            ->whereBetween(DB::raw('coalesce(order_date, created_at)::date'), [$from, $to])
            ->when($customerIds, fn ($q) => $q->whereIn('customer_id', $customerIds))
            ->sum(DB::raw('coalesce(final_amount, total_amount)'));
        $totals = $base()->selectRaw('count(*) as n, coalesce(sum(total_amount),0) as total, coalesce(sum(amount_paid),0) as paid, coalesce(sum(amount_credited),0) as credited, coalesce(sum(balance_amount),0) as balance')->first();

        $topCustomers = $base()->join('customers as c', 'c.id', '=', 'invoices.customer_id')
            ->groupBy('c.id', 'c.name', 'c.business_name')
            ->selectRaw("coalesce(nullif(trim(c.business_name), ''), c.name) as customer, count(*) as invoices, sum(invoices.total_amount) as total")
            ->orderByDesc('total')->limit(5)->get();

        $topProducts = DB::table('invoice_line_items as l')
            ->whereIn('l.invoice_id', $base()->select('invoices.id'))
            ->groupBy('l.description')
            ->selectRaw('l.description, sum(l.quantity) as quantity, sum(l.line_total) as value')
            ->orderByDesc('value')->limit(5)->get();

        return [
            'period' => ['from' => $from, 'to' => $to],
            'customer' => $args['customer'] ?? null,
            'invoice_count' => (int) $totals->n,
            'orders_total' => self::money($ordersTotal),
            'total_invoiced' => self::money($totals->total),
            'paid' => self::money($totals->paid),
            'credited' => self::money($totals->credited),
            'outstanding' => self::money($totals->balance),
            'top_customers' => $topCustomers->map(fn ($r) => ['customer' => $r->customer, 'invoices' => (int) $r->invoices, 'total' => self::money($r->total)]),
            'top_products' => $topProducts->map(fn ($r) => ['product' => $r->description, 'quantity' => (float) $r->quantity, 'value' => self::money($r->value)]),
        ];
    }

    protected function customer_account(array $args): array
    {
        $term = trim((string) ($args['query'] ?? ''));
        $customers = $this->matchingCustomers($term)->take(5);
        if ($customers->isEmpty()) {
            return ['customers' => [], 'did_you_mean' => $this->suggestCustomers($term)];
        }

        return ['customers' => $customers->map(function (Customer $c) {
            $open = $this->liveInvoices()->where('customer_id', $c->id)->where('balance_amount', '>', 0.005)
                ->orderBy('invoice_date')->get();
            $lastPayment = Payment::where('company_id', $this->companyId)->where('customer_id', $c->id)
                ->whereNotIn('status', ['cancelled', 'failed', 'bounced'])
                ->orderByDesc('payment_date')->first(['amount_paid', 'payment_date', 'payment_method']);
            return [
                'customer' => self::customerName($c),
                'customer_number' => $c->customer_number,
                'payment_method' => $c->payment_method,
                'outstanding' => self::money($open->sum('balance_amount')),
                'overdue' => self::money($open->filter(fn ($i) => $i->due_date && $i->due_date->lt(today()))->sum('balance_amount')),
                'open_invoices' => $open->take(15)->map(fn ($i) => ['number' => $i->invoice_number, 'date' => optional($i->invoice_date)->toDateString(), 'due' => optional($i->due_date)->toDateString(), 'balance' => self::money($i->balance_amount)])->values(),
                'last_payment' => $lastPayment ? ['amount' => self::money($lastPayment->amount_paid), 'date' => substr((string) $lastPayment->payment_date, 0, 10), 'method' => $lastPayment->payment_method] : null,
            ];
        })->values()];
    }

    protected function customer_stats(array $args): array
    {
        $filters = array_filter(['date_from' => $args['date_from'] ?? null, 'date_to' => $args['date_to'] ?? null]);
        $stats = app(\App\Services\ReportService::class)->forCompany($this->companyId)->getCustomerStats($filters);
        $words = collect(preg_split('/\s+/', strtolower(trim((string) ($args['search'] ?? '')))))->filter(fn ($w) => strlen($w) > 1);
        $only = $args['only'] ?? 'all';

        $rows = collect($stats['rows'])
            ->filter(fn ($r) => $words->every(fn ($w) => str_contains(strtolower((string) $r['customer']), $w)))
            ->filter(fn ($r) => $only === 'with_orders' ? $r['orders'] > 0 : ($only === 'without_orders' ? $r['orders'] === 0 : true));
        $rows = match ($args['sort'] ?? 'order_value') {
            'orders' => $rows->sortByDesc('orders'),
            'balance' => $rows->sortByDesc('balance'),
            'name' => $rows->sortBy(fn ($r) => strtolower((string) $r['customer'])),
            default => $rows->sortByDesc('order_value'),
        };
        $rows = $rows->values();

        $fmt = fn ($v) => number_format((float) $v, 2);
        $table = $rows->isEmpty() ? '' : "| S/No | Customer | Orders | Order Value | Invoiced | Paid | Balance | Last Order |\n|---|---|---|---|---|---|---|---|\n"
            . $rows->map(fn ($r, $i) => '| ' . ($i + 1) . ' | ' . str_replace('|', '/', (string) $r['customer']) . " | {$r['orders']} | {$fmt($r['order_value'])} | {$fmt($r['invoiced'])} | {$fmt($r['paid'])} | {$fmt($r['balance'])} | " . ($r['last_order_date'] ?? '-') . ' |')->implode("\n");

        return [
            'period' => $filters ?: 'all time',
            'customers_listed' => $rows->count(),
            'with_orders' => $rows->where('orders', '>', 0)->count(),
            'without_orders' => $rows->where('orders', 0)->count(),
            'total_orders' => $rows->sum('orders'),
            'total_order_value' => self::money($rows->sum('order_value')),
            'total_invoiced' => self::money($rows->sum('invoiced')),
            'total_balance' => self::money($rows->sum('balance')),
            'top' => $rows->take(5)->map(fn ($r) => ['customer' => $r['customer'], 'orders' => $r['orders'], 'order_value' => $r['order_value']])->all(),
            'full_list_link' => '[CRM Reports > Customer Stats](/reports/customers?tab=stats)',
            'table_shown_to_user' => $table !== '' ? 'The full table of every customer is added under your answer automatically.' : 'No customer matched.',
            '_table' => $table,
        ];
    }

    protected function receipts_summary(array $args): array
    {
        [$from, $to] = $this->range($args);
        $base = fn () => Payment::where('company_id', $this->companyId)
            ->whereNotIn('status', ['cancelled', 'failed', 'bounced'])
            ->whereBetween(DB::raw('coalesce(payment_date, created_at)::date'), [$from, $to]);
        // "Cash"/"cash", "M-Pesa"/"mpesa", "Bank Transfer"/"bank_transfer" are the same method.
        $byMethod = $base()->groupBy('payment_method')->selectRaw('payment_method, count(*) as n, sum(amount_paid - coalesce(amount_refunded, 0)) as total')->get()
            ->groupBy(fn ($r) => strtolower(preg_replace('/[^a-z]/i', '', (string) $r->payment_method)))
            ->map(fn ($g) => (object) ['payment_method' => ['cash' => 'Cash', 'mpesa' => 'M-Pesa', 'banktransfer' => 'Bank Transfer', 'cheque' => 'Cheque'][strtolower(preg_replace('/[^a-z]/i', '', (string) $g->first()->payment_method))] ?? $g->first()->payment_method,
                'n' => $g->sum('n'), 'total' => $g->sum('total')])
            ->values();
        $latest = $base()->with('customer:id,name,business_name')->orderByDesc('payment_date')->limit(10)->get();
        return [
            'period' => ['from' => $from, 'to' => $to],
            'total_received' => self::money($byMethod->sum('total')),
            'by_method' => $byMethod->map(fn ($r) => ['method' => $r->payment_method, 'count' => (int) $r->n, 'total' => self::money($r->total)]),
            'latest' => $latest->map(fn ($p) => ['date' => substr((string) $p->payment_date, 0, 10), 'customer' => self::customerName($p->customer), 'amount' => self::money($p->amount_paid), 'method' => $p->payment_method, 'reference' => $p->transaction_id]),
        ];
    }

    protected function expenses_summary(array $args): array
    {
        [$from, $to] = $this->range($args);
        $base = function () use ($from, $to, $args) {
            $q = Expense::where('expenses.company_id', $this->companyId)->whereBetween('expense_date', [$from, $to]);
            if (!empty($args['category'])) {
                $q->whereHas('category', fn ($c) => $c->where('name', 'ilike', '%' . $args['category'] . '%'));
            }
            return $q;
        };
        $byCategory = $base()->leftJoin('expense_categories as c', 'c.id', '=', 'expenses.category_id')
            ->groupBy('c.name')->selectRaw("coalesce(c.name, 'Uncategorised') as category, count(*) as n, sum(expenses.amount) as total")
            ->orderByDesc('total')->get();
        $byStatus = $base()->groupBy('status')->selectRaw('status, sum(amount) as total')->pluck('total', 'status');
        $latest = $base()->with('category:id,name')->orderByDesc('expense_date')->limit(10)->get();
        return [
            'period' => ['from' => $from, 'to' => $to],
            'total' => self::money($byCategory->sum('total')),
            'by_status' => $byStatus->map(fn ($v) => self::money($v)),
            'by_category' => $byCategory->map(fn ($r) => ['category' => $r->category, 'count' => (int) $r->n, 'total' => self::money($r->total)]),
            'latest' => $latest->map(fn ($e) => ['date' => substr((string) $e->expense_date, 0, 10), 'description' => $e->description, 'category' => $e->category?->name, 'amount' => self::money($e->amount), 'status' => $e->status, 'vendor' => $e->vendor_name]),
        ];
    }

    protected function purchase_orders(array $args): array
    {
        $q = PurchaseOrder::where('company_id', $this->companyId)->with('supplier:id,name');
        if (!empty($args['status'])) {
            $q->where('status', $args['status']);
        }
        $orders = $q->orderByDesc('order_date')->orderByDesc('created_at')->limit($this->limit($args, 8, 25))->get();
        return ['purchase_orders' => $orders->map(fn ($o) => [
            'number' => $o->order_number,
            'date' => substr((string) $o->order_date, 0, 10),
            'supplier' => $o->supplier?->name,
            'total' => self::money($o->total_amount),
            'paid' => self::money($o->amount_paid),
            'status' => $o->status,
            'approval' => $o->approval_status,
            'payment' => $o->payment_status,
        ])->values()];
    }
}
