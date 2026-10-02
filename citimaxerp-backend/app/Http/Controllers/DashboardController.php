<?php

namespace App\Http\Controllers;

use App\Models\DashboardWidget;
use App\Models\DashboardConfiguration;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Invoice;
use App\Models\Expense;
use App\Models\User;
use App\Models\StockCount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }
    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * Get dashboard overview with key metrics.
     */
    public function overview(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_view_dashboard', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view dashboard.',
            ], 403);
        }
        try {
            $dateRange = $this->parseDateRange($request);
            $previousDateRange = $this->getPreviousDateRange($dateRange);
            $overview = [
                'period' => [
                    'from' => $dateRange['from'],
                    'to' => $dateRange['to'],
                    'label' => $this->getDateRangeLabel($request)
                ],
                'sales_metrics' => $this->getSalesMetrics($companyId, $dateRange, $previousDateRange),
                'financial_metrics' => $this->getFinancialMetrics($companyId, $dateRange, $previousDateRange),
                'customer_metrics' => $this->getCustomerMetrics($companyId, $dateRange, $previousDateRange),
                'inventory_metrics' => $this->getInventoryMetrics($companyId, $dateRange),
                'recent_activity' => $this->getRecentActivity($companyId),
            ];
            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard overview retrieved successfully.',
                'data' => $overview,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve dashboard overview', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve dashboard overview: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get sales analytics data.
     */
    public function salesAnalytics(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_view_dashboard', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view sales analytics.',
            ], 403);
        }
        try {
            $dateRange = $this->parseDateRange($request);
            $groupBy = $request->input('group_by', 'day'); // day, week, month
            $analytics = [
                'revenue_trend' => $this->getRevenueTrend($companyId, $dateRange, $groupBy),
                'sales_by_product' => $this->getSalesByProduct($companyId, $dateRange),
                'sales_by_category' => $this->getSalesByCategory($companyId, $dateRange),
                'payment_methods' => $this->getPaymentMethodBreakdown($companyId, $dateRange),
                'order_status_breakdown' => $this->getOrderStatusBreakdown($companyId, $dateRange),
                'average_order_value' => $this->getAverageOrderValue($companyId, $dateRange, $groupBy),
            ];
            return response()->json([
                'status' => 'success',
                'message' => 'Sales analytics retrieved successfully.',
                'data' => $analytics,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve sales analytics', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve sales analytics: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get financial analytics data.
     */
    public function financialAnalytics(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_view_dashboard', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial analytics.',
            ], 403);
        }
        try {
            $dateRange = $this->parseDateRange($request);
            $analytics = [
                'cash_flow' => $this->getCashFlowAnalysis($companyId, $dateRange),
                'expense_breakdown' => $this->getExpenseBreakdown($companyId, $dateRange),
                'profit_loss' => $this->getProfitLossAnalysis($companyId, $dateRange),
                'accounts_receivable' => $this->getAccountsReceivableAnalysis($companyId),
                'payment_trends' => $this->getPaymentTrends($companyId, $dateRange),
            ];
            return response()->json([
                'status' => 'success',
                'message' => 'Financial analytics retrieved successfully.',
                'data' => $analytics,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve financial analytics', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve financial analytics: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get customer analytics data.
     */
    public function customerAnalytics(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_view_dashboard', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customer analytics.',
            ], 403);
        }
        try {
            $dateRange = $this->parseDateRange($request);
            $analytics = [
                'customer_acquisition' => $this->getCustomerAcquisition($companyId, $dateRange),
                'customer_retention' => $this->getCustomerRetention($companyId, $dateRange),
                'customer_lifetime_value' => $this->getCustomerLifetimeValue($companyId),
                'top_customers' => $this->getTopCustomers($companyId, $dateRange),
                'customer_segments' => $this->getCustomerSegments($companyId),
            ];
            return response()->json([
                'status' => 'success',
                'message' => 'Customer analytics retrieved successfully.',
                'data' => $analytics,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve customer analytics', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve customer analytics: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get inventory analytics data.
     */
    public function inventoryAnalytics(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_view_dashboard', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view inventory analytics.',
            ], 403);
        }
        try {
            $analytics = [
                'inventory_levels' => $this->getInventoryLevels($companyId),
                'stock_alerts' => $this->getStockAlerts($companyId),
                'inventory_turnover' => $this->getInventoryTurnover($companyId),
                'dead_stock' => $this->getDeadStock($companyId),
                'product_performance' => $this->getProductPerformance($companyId),
            ];
            return response()->json([
                'status' => 'success',
                'message' => 'Inventory analytics retrieved successfully.',
                'data' => $analytics,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve inventory analytics', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve inventory analytics: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ===========================================
    // DASHBOARD WIDGET MANAGEMENT
    // ===========================================

    /**
     * Get user's dashboard configuration.
     */
    public function getDashboardConfig(Request $request)
    {
        try {
            $user = $request->user();
            
            // Get user's default dashboard configuration
            $config = DashboardConfiguration::forUser($user->id)->whereRaw('is_default = true')->first();
            
            if (!$config) {
                // Create default configuration
                $config = DashboardConfiguration::create([
                    'user_id' => $user->id,
                    'company_id' => $user->company_id,
                    'dashboard_name' => 'Default Dashboard',
                    'layout_configuration' => (new DashboardConfiguration())->getDefaultLayoutConfiguration(),
                    'is_default' => true, // Use boolean true for PostgreSQL
                ]);
            }

            // Get available widgets for the company
            $availableWidgets = DashboardWidget::forCompany($user->company_id)
                ->active()
                ->orderBy('widget_type')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard configuration retrieved successfully.',
                'data' => [
                    'configuration' => $config,
                    'available_widgets' => $availableWidgets,
                ],
            ], 200);

        } catch (\Exception $e) {
            Log::error('Failed to retrieve dashboard configuration', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve dashboard configuration: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update user's dashboard configuration.
     */
    public function updateDashboardConfig(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dashboard_name' => 'sometimes|string|max:255',
            'layout_configuration' => 'sometimes|array',
            'global_filters' => 'sometimes|array',
            'refresh_interval' => 'sometimes|string|in:1m,5m,15m,30m,1h,manual',
            'theme' => 'sometimes|string|in:light,dark,auto',
            'is_default' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            
            $config = DashboardConfiguration::forUser($user->id)->whereRaw('is_default = true')->first();
            
            if (!$config) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Dashboard configuration not found.',
                ], 404);
            }

            $config->update($request->only([
                'dashboard_name',
                'layout_configuration',
                'global_filters',
                'refresh_interval',
                'theme',
            ]));

            if ($request->input('is_default', false)) {
                $config->makeDefault();
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard configuration updated successfully.',
                'data' => $config->fresh(),
            ], 200);

        } catch (\Exception $e) {
            Log::error('Failed to update dashboard configuration', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update dashboard configuration: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ===========================================
    // PRIVATE HELPER METHODS
    // ===========================================

    /**
     * Parse date range from request.
     */
    private function parseDateRange(Request $request)
    {
        $period = $request->input('period', 'last_30_days');
        $customFrom = $request->input('date_from');
        $customTo = $request->input('date_to');

        if ($customFrom && $customTo) {
            return [
                'from' => Carbon::parse($customFrom)->startOfDay(),
                'to' => Carbon::parse($customTo)->endOfDay(),
            ];
        }

        switch ($period) {
            case 'today':
                return ['from' => Carbon::today(), 'to' => Carbon::today()->endOfDay()];
            case 'yesterday':
                return ['from' => Carbon::yesterday(), 'to' => Carbon::yesterday()->endOfDay()];
            case 'last_7_days':
                return ['from' => Carbon::now()->subDays(7), 'to' => Carbon::now()];
            case 'last_30_days':
                return ['from' => Carbon::now()->subDays(30), 'to' => Carbon::now()];
            case 'this_month':
                return ['from' => Carbon::now()->startOfMonth(), 'to' => Carbon::now()->endOfMonth()];
            case 'last_month':
                return ['from' => Carbon::now()->subMonth()->startOfMonth(), 'to' => Carbon::now()->subMonth()->endOfMonth()];
            case 'this_quarter':
                return ['from' => Carbon::now()->startOfQuarter(), 'to' => Carbon::now()->endOfQuarter()];
            case 'this_year':
                return ['from' => Carbon::now()->startOfYear(), 'to' => Carbon::now()->endOfYear()];
            default:
                return ['from' => Carbon::now()->subDays(30), 'to' => Carbon::now()];
        }
    }

    /**
     * Get previous date range for comparison.
     */
    private function getPreviousDateRange($currentRange)
    {
        $days = $currentRange['from']->diffInDays($currentRange['to']);
        
        return [
            'from' => $currentRange['from']->copy()->subDays($days + 1),
            'to' => $currentRange['from']->copy()->subDay(),
        ];
    }

    /**
     * Get date range label.
     */
    private function getDateRangeLabel(Request $request)
    {
        $period = $request->input('period', 'last_30_days');
        
        $labels = [
            'today' => 'Today',
            'yesterday' => 'Yesterday',
            'last_7_days' => 'Last 7 Days',
            'last_30_days' => 'Last 30 Days',
            'this_month' => 'This Month',
            'last_month' => 'Last Month',
            'this_quarter' => 'This Quarter',
            'this_year' => 'This Year',
        ];

        return $labels[$period] ?? 'Custom Range';
    }

    /**
     * Get sales metrics.
     */
    private function getSalesMetrics($companyId, $dateRange, $previousDateRange)
    {
        // Current period metrics
        $currentOrders = Order::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw("
                COUNT(*) as total_orders,
                SUM(final_amount) as total_revenue,
                SUM(amount_paid) as total_paid,
                AVG(final_amount) as avg_order_value,
                COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders
            ")
            ->first();

        // Previous period metrics for comparison
        $previousOrders = Order::where('company_id', $companyId)
            ->whereBetween('created_at', [$previousDateRange['from'], $previousDateRange['to']])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(final_amount) as total_revenue,
                SUM(amount_paid) as total_paid,
                AVG(final_amount) as avg_order_value
            ')
            ->first();

        return [
            'total_orders' => [
                'current' => $currentOrders->total_orders ?? 0,
                'previous' => $previousOrders->total_orders ?? 0,
                'change_percent' => $this->calculatePercentageChange(
                    $previousOrders->total_orders ?? 0,
                    $currentOrders->total_orders ?? 0
                ),
            ],
            'total_revenue' => [
                'current' => (float) ($currentOrders->total_revenue ?? 0),
                'previous' => (float) ($previousOrders->total_revenue ?? 0),
                'change_percent' => $this->calculatePercentageChange(
                    $previousOrders->total_revenue ?? 0,
                    $currentOrders->total_revenue ?? 0
                ),
            ],
            'avg_order_value' => [
                'current' => (float) ($currentOrders->avg_order_value ?? 0),
                'previous' => (float) ($previousOrders->avg_order_value ?? 0),
                'change_percent' => $this->calculatePercentageChange(
                    $previousOrders->avg_order_value ?? 0,
                    $currentOrders->avg_order_value ?? 0
                ),
            ],
            'paid_orders' => $currentOrders->paid_orders ?? 0,
            'conversion_rate' => $currentOrders->total_orders > 0 
                ? round(($currentOrders->paid_orders / $currentOrders->total_orders) * 100, 2)
                : 0,
        ];
    }

    /**
     * Get financial metrics.
     */
    private function getFinancialMetrics($companyId, $dateRange, $previousDateRange)
    {
        // Current period payments
        $currentPayments = Payment::where('company_id', $companyId)
            ->whereBetween('payment_date', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                SUM(amount_paid) as total_payments,
                COUNT(*) as payment_count,
                AVG(amount_paid) as avg_payment_amount
            ')
            ->first();

        // Current period expenses
        $currentExpenses = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$dateRange['from'], $dateRange['to']])
            ->sum('amount');

        // Previous period for comparison
        $previousPayments = Payment::where('company_id', $companyId)
            ->whereBetween('payment_date', [$previousDateRange['from'], $previousDateRange['to']])
            ->sum('amount_paid');

        $previousExpenses = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$previousDateRange['from'], $previousDateRange['to']])
            ->sum('amount');

        // Outstanding invoices
        $outstandingInvoices = Invoice::where('company_id', $companyId)
            ->where('balance_amount', '>', 0)
            ->selectRaw('
                COUNT(*) as count,
                SUM(balance_amount) as total_outstanding
            ')
            ->first();

        $currentProfit = ($currentPayments->total_payments ?? 0) - $currentExpenses;
        $previousProfit = $previousPayments - $previousExpenses;

        return [
            'total_payments' => [
                'current' => (float) ($currentPayments->total_payments ?? 0),
                'previous' => (float) $previousPayments,
                'change_percent' => $this->calculatePercentageChange($previousPayments, $currentPayments->total_payments ?? 0),
            ],
            'total_expenses' => [
                'current' => (float) $currentExpenses,
                'previous' => (float) $previousExpenses,
                'change_percent' => $this->calculatePercentageChange($previousExpenses, $currentExpenses),
            ],
            'net_profit' => [
                'current' => (float) $currentProfit,
                'previous' => (float) $previousProfit,
                'change_percent' => $this->calculatePercentageChange($previousProfit, $currentProfit),
            ],
            'outstanding_amount' => (float) ($outstandingInvoices->total_outstanding ?? 0),
            'outstanding_invoices_count' => $outstandingInvoices->count ?? 0,
        ];
    }

    /**
     * Get customer metrics.
     */
    private function getCustomerMetrics($companyId, $dateRange, $previousDateRange)
    {
        // New customers in current period
        $newCustomers = Customer::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']])
            ->count();

        // New customers in previous period
        $previousNewCustomers = Customer::where('company_id', $companyId)
            ->whereBetween('created_at', [$previousDateRange['from'], $previousDateRange['to']])
            ->count();

        // Total active customers
        $totalCustomers = Customer::where('company_id', $companyId)->count();

        // Repeat customers (customers with more than one order)
        $repeatCustomers = Customer::where('company_id', $companyId)
            ->whereHas('orders', function ($query) use ($dateRange) {
                $query->whereBetween('created_at', [$dateRange['from'], $dateRange['to']]);
            }, '>', 1)
            ->count();

        return [
            'total_customers' => $totalCustomers,
            'new_customers' => [
                'current' => $newCustomers,
                'previous' => $previousNewCustomers,
                'change_percent' => $this->calculatePercentageChange($previousNewCustomers, $newCustomers),
            ],
            'repeat_customers' => $repeatCustomers,
            'customer_retention_rate' => $totalCustomers > 0 
                ? round(($repeatCustomers / $totalCustomers) * 100, 2)
                : 0,
        ];
    }

    /**
     * Get inventory metrics.
     */
    private function getInventoryMetrics($companyId, $dateRange)
    {
        // Use Product table directly for inventory analytics
        $inventoryData = Product::where('company_id', $companyId)
            ->selectRaw('
                COUNT(*) as total_products,
                SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_products,
                SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_products,
                SUM(stock_quantity * unit_cost) as total_inventory_value
            ')
            ->first();

        $totalProducts = $inventoryData->total_products ?? 0;
        $lowStockProducts = $inventoryData->low_stock_products ?? 0;
        $outOfStockProducts = $inventoryData->out_of_stock_products ?? 0;
        $inventoryValue = $inventoryData->total_inventory_value ?? 0;

        return [
            'total_products' => (int) $totalProducts,
            'low_stock_products' => (int) $lowStockProducts,
            'out_of_stock_products' => (int) $outOfStockProducts,
            'total_inventory_value' => (float) $inventoryValue,
            'stock_health_score' => $totalProducts > 0
                ? round((($totalProducts - $lowStockProducts - $outOfStockProducts) / $totalProducts) * 100, 2)
                : 100,
        ];
    }

    /**
     * Get recent activity.
     */
    private function getRecentActivity($companyId)
    {
        $recentOrders = Order::where('company_id', $companyId)
            ->with(['customer'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'type' => 'order',
                    'description' => "New order #{$order->order_number} from " . ($order->customer->name ?? 'Unknown Customer'),
                    'amount' => $order->final_amount,
                    'status' => $order->status,
                    'created_at' => $order->created_at,
                ];
            });

        $recentPayments = Payment::where('company_id', $companyId)
            ->with(['customer', 'order'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'type' => 'payment',
                    'description' => "Payment received from " . ($payment->customer->name ?? 'Unknown Customer'),
                    'amount' => $payment->amount_paid,
                    'status' => $payment->status,
                    'created_at' => $payment->created_at,
                ];
            });

        return $recentOrders->merge($recentPayments)
            ->sortByDesc('created_at')
            ->take(10)
            ->values();
    }

    /**
     * Calculate percentage change between two values.
     */
    private function calculatePercentageChange($oldValue, $newValue)
    {
        if ($oldValue == 0) {
            return $newValue > 0 ? 100 : 0;
        }
        
        return round((($newValue - $oldValue) / $oldValue) * 100, 2);
    }

    /**
     * Get revenue trend data.
     */
    private function getRevenueTrend($companyId, $dateRange, $groupBy)
    {
        $query = Order::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']]);

        switch ($groupBy) {
            case 'day':
                $trend = $query->selectRaw('DATE(created_at) as period, SUM(final_amount) as revenue, COUNT(*) as orders')
                    ->groupBy(DB::raw('DATE(created_at)'))
                    ->orderBy('period')
                    ->get();
                break;
            case 'week':
                $trend = $query->selectRaw('YEARWEEK(created_at) as period, SUM(final_amount) as revenue, COUNT(*) as orders')
                    ->groupBy(DB::raw('YEARWEEK(created_at)'))
                    ->orderBy('period')
                    ->get();
                break;
            case 'month':
                $trend = $query->selectRaw('DATE_FORMAT(created_at, "%Y-%m") as period, SUM(final_amount) as revenue, COUNT(*) as orders')
                    ->groupBy(DB::raw('DATE_FORMAT(created_at, "%Y-%m")'))
                    ->orderBy('period')
                    ->get();
                break;
            default:
                $trend = collect();
        }

        return $trend->map(function ($item) {
            return [
                'period' => $item->period,
                'revenue' => (float) $item->revenue,
                'orders' => (int) $item->orders,
            ];
        });
    }

    /**
     * Get sales by product.
     */
    private function getSalesByProduct($companyId, $dateRange)
    {
        return DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $companyId)
            ->whereBetween('orders.created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                products.id,
                products.name,
                SUM(order_items.quantity) as total_quantity,
                SUM(order_items.quantity * order_items.unit_price) as total_revenue,
                COUNT(DISTINCT orders.id) as order_count
            ')
            ->groupBy('products.id', 'products.name')
            ->orderBy('total_revenue', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($item) {
                return [
                    'product_id' => $item->id,
                    'product_name' => $item->name,
                    'quantity_sold' => (int) $item->total_quantity,
                    'revenue' => (float) $item->total_revenue,
                    'order_count' => (int) $item->order_count,
                ];
            });
    }

    /**
     * Get sales by category.
     */
    private function getSalesByCategory($companyId, $dateRange)
    {
        return DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $companyId)
            ->whereBetween('orders.created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                products.category,
                SUM(order_items.quantity) as total_quantity,
                SUM(order_items.quantity * order_items.unit_price) as total_revenue,
                COUNT(DISTINCT orders.id) as order_count
            ')
            ->groupBy('products.category')
            ->orderBy('total_revenue', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'category' => $item->category ?: 'Uncategorized',
                    'quantity_sold' => (int) $item->total_quantity,
                    'revenue' => (float) $item->total_revenue,
                    'order_count' => (int) $item->order_count,
                ];
            });
    }

    /**
     * Get payment method breakdown.
     */
    private function getPaymentMethodBreakdown($companyId, $dateRange)
    {
        return Payment::where('company_id', $companyId)
            ->whereBetween('payment_date', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                payment_method,
                COUNT(*) as transaction_count,
                SUM(amount_paid) as total_amount
            ')
            ->groupBy('payment_method')
            ->orderBy('total_amount', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'payment_method' => $item->payment_method,
                    'transaction_count' => (int) $item->transaction_count,
                    'total_amount' => (float) $item->total_amount,
                ];
            });
    }

    /**
     * Get order status breakdown.
     */
    private function getOrderStatusBreakdown($companyId, $dateRange)
    {
        return Order::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                status,
                COUNT(*) as order_count,
                SUM(final_amount) as total_amount
            ')
            ->groupBy('status')
            ->get()
            ->map(function ($item) {
                return [
                    'status' => $item->status,
                    'order_count' => (int) $item->order_count,
                    'total_amount' => (float) $item->total_amount,
                ];
            });
    }

    /**
     * Get average order value trend.
     */
    private function getAverageOrderValue($companyId, $dateRange, $groupBy)
    {
        $query = Order::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']]);

        switch ($groupBy) {
            case 'day':
                $trend = $query->selectRaw('DATE(created_at) as period, AVG(final_amount) as avg_order_value')
                    ->groupBy(DB::raw('DATE(created_at)'))
                    ->orderBy('period')
                    ->get();
                break;
            case 'week':
                $trend = $query->selectRaw('YEARWEEK(created_at) as period, AVG(final_amount) as avg_order_value')
                    ->groupBy(DB::raw('YEARWEEK(created_at)'))
                    ->orderBy('period')
                    ->get();
                break;
            case 'month':
                $trend = $query->selectRaw('DATE_FORMAT(created_at, "%Y-%m") as period, AVG(final_amount) as avg_order_value')
                    ->groupBy(DB::raw('DATE_FORMAT(created_at, "%Y-%m")'))
                    ->orderBy('period')
                    ->get();
                break;
            default:
                $trend = collect();
        }

        return $trend->map(function ($item) {
            return [
                'period' => $item->period,
                'avg_order_value' => (float) $item->avg_order_value,
            ];
        });
    }

    // ===========================================
    // FINANCIAL ANALYTICS METHODS
    // ===========================================

    /**
     * Get cash flow analysis.
     */
    private function getCashFlowAnalysis($companyId, $dateRange)
    {
        $cashIn = Payment::where('company_id', $companyId)
            ->whereBetween('payment_date', [$dateRange['from'], $dateRange['to']])
            ->where('status', 'completed')
            ->sum('amount_paid');

        $cashOut = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$dateRange['from'], $dateRange['to']])
            ->where('status', 'paid')
            ->sum('amount');

        $netCashFlow = $cashIn - $cashOut;

        // Monthly cash flow trend
        $monthlyTrend = DB::table('payments')
            ->where('company_id', $companyId)
            ->where('status', 'completed')
            ->whereBetween('payment_date', [
                $dateRange['from']->copy()->subMonths(11),
                $dateRange['to']
            ])
            ->selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount_paid) as cash_in")
            ->groupBy(DB::raw("TO_CHAR(payment_date, 'YYYY-MM')"))
            ->orderBy('month')
            ->get();

        return [
            'cash_in' => (float) $cashIn,
            'cash_out' => (float) $cashOut,
            'net_cash_flow' => (float) $netCashFlow,
            'monthly_trend' => $monthlyTrend->map(function ($item) {
                return [
                    'month' => $item->month,
                    'cash_in' => (float) $item->cash_in,
                ];
            }),
        ];
    }

    /**
     * Get expense breakdown.
     */
    private function getExpenseBreakdown($companyId, $dateRange)
    {
        $byCategory = DB::table('expenses')
            ->leftJoin('expense_categories', 'expenses.category_id', '=', 'expense_categories.id')
            ->where('expenses.company_id', $companyId)
            ->whereBetween('expenses.expense_date', [$dateRange['from'], $dateRange['to']])
            ->selectRaw("
                COALESCE(expense_categories.name, 'Uncategorized') as category,
                SUM(expenses.amount) as total_amount,
                COUNT(*) as expense_count
            ")
            ->groupBy('expense_categories.name')
            ->orderBy('total_amount', 'desc')
            ->get();

        $byPaymentMethod = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                payment_method,
                SUM(amount) as total_amount,
                COUNT(*) as expense_count
            ')
            ->groupBy('payment_method')
            ->orderBy('total_amount', 'desc')
            ->get();

        $totalExpenses = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$dateRange['from'], $dateRange['to']])
            ->sum('amount');

        return [
            'by_category' => $byCategory->map(function ($item) {
                return [
                    'category' => $item->category,
                    'amount' => (float) $item->total_amount,
                    'count' => (int) $item->expense_count,
                ];
            }),
            'by_payment_method' => $byPaymentMethod->map(function ($item) {
                return [
                    'payment_method' => $item->payment_method,
                    'amount' => (float) $item->total_amount,
                    'count' => (int) $item->expense_count,
                ];
            }),
            'total_expenses' => (float) $totalExpenses,
        ];
    }

    /**
     * Get profit and loss analysis.
     */
    private function getProfitLossAnalysis($companyId, $dateRange)
    {
        $revenue = Order::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']])
            ->where('payment_status', 'paid')
            ->sum('final_amount');

        $expenses = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$dateRange['from'], $dateRange['to']])
            ->sum('amount');

        // Cost of goods sold (simplified - using product costs from order items)
        $cogs = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $companyId)
            ->where('orders.payment_status', 'paid')
            ->whereBetween('orders.created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('SUM(order_items.quantity * products.unit_cost) as total_cogs')
            ->value('total_cogs') ?? 0;

        $grossProfit = $revenue - $cogs;
        $netProfit = $grossProfit - $expenses;

        return [
            'revenue' => (float) $revenue,
            'cost_of_goods_sold' => (float) $cogs,
            'gross_profit' => (float) $grossProfit,
            'operating_expenses' => (float) $expenses,
            'net_profit' => (float) $netProfit,
            'gross_margin' => $revenue > 0 ? round(($grossProfit / $revenue) * 100, 2) : 0,
            'net_margin' => $revenue > 0 ? round(($netProfit / $revenue) * 100, 2) : 0,
        ];
    }

    /**
     * Get accounts receivable analysis.
     */
    private function getAccountsReceivableAnalysis($companyId)
    {
        $outstandingInvoices = Invoice::where('company_id', $companyId)
            ->where('balance_amount', '>', 0)
            ->selectRaw('
                COUNT(*) as invoice_count,
                SUM(balance_amount) as total_outstanding,
                AVG((NOW()::date - due_date)) as avg_days_overdue
            ')
            ->first();

        // Aging buckets
        $agingBuckets = [
            'current' => Invoice::where('company_id', $companyId)
                ->where('balance_amount', '>', 0)
                ->where('due_date', '>=', Carbon::today())
                ->sum('balance_amount'),
            '1_30_days' => Invoice::where('company_id', $companyId)
                ->where('balance_amount', '>', 0)
                ->whereBetween('due_date', [Carbon::today()->subDays(30), Carbon::today()->subDay()])
                ->sum('balance_amount'),
            '31_60_days' => Invoice::where('company_id', $companyId)
                ->where('balance_amount', '>', 0)
                ->whereBetween('due_date', [Carbon::today()->subDays(60), Carbon::today()->subDays(31)])
                ->sum('balance_amount'),
            'over_60_days' => Invoice::where('company_id', $companyId)
                ->where('balance_amount', '>', 0)
                ->where('due_date', '<', Carbon::today()->subDays(60))
                ->sum('balance_amount'),
        ];

        return [
            'total_outstanding' => (float) ($outstandingInvoices->total_outstanding ?? 0),
            'invoice_count' => (int) ($outstandingInvoices->invoice_count ?? 0),
            'avg_days_overdue' => round($outstandingInvoices->avg_days_overdue ?? 0, 1),
            'aging_buckets' => $agingBuckets,
        ];
    }

    /**
     * Get payment trends.
     */
    private function getPaymentTrends($companyId, $dateRange)
    {
        $dailyPayments = Payment::where('company_id', $companyId)
            ->whereBetween('payment_date', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('DATE(payment_date) as date, SUM(amount_paid) as total_amount, COUNT(*) as payment_count')
            ->groupBy(DB::raw('DATE(payment_date)'))
            ->orderBy('date')
            ->get();

        $paymentMethodTrends = Payment::where('company_id', $companyId)
            ->whereBetween('payment_date', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('payment_method, DATE(payment_date) as date, SUM(amount_paid) as amount')
            ->groupBy('payment_method', DB::raw('DATE(payment_date)'))
            ->orderBy('date')
            ->get()
            ->groupBy('payment_method');

        return [
            'daily_payments' => $dailyPayments->map(function ($item) {
                return [
                    'date' => $item->date,
                    'amount' => (float) $item->total_amount,
                    'count' => (int) $item->payment_count,
                ];
            }),
            'by_payment_method' => $paymentMethodTrends->map(function ($payments, $method) {
                return [
                    'payment_method' => $method,
                    'trend' => $payments->map(function ($payment) {
                        return [
                            'date' => $payment->date,
                            'amount' => (float) $payment->amount,
                        ];
                    }),
                ];
            }),
        ];
    }

    // ===========================================
    // CUSTOMER ANALYTICS METHODS
    // ===========================================

    /**
     * Get customer acquisition data.
     */
    private function getCustomerAcquisition($companyId, $dateRange)
    {
        $acquisitionData = Customer::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('DATE(created_at) as date, COUNT(*) as new_customers')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get();

        $totalNewCustomers = Customer::where('company_id', $companyId)
            ->whereBetween('created_at', [$dateRange['from'], $dateRange['to']])
            ->count();

        // Customer acquisition cost (simplified - total marketing expenses / new customers)
        $marketingExpenses = Expense::where('company_id', $companyId)
            ->whereBetween('expense_date', [$dateRange['from'], $dateRange['to']])
            ->where('description', 'like', '%marketing%')
            ->orWhere('description', 'like', '%advertising%')
            ->sum('amount');

        $acquisitionCost = $totalNewCustomers > 0 ? $marketingExpenses / $totalNewCustomers : 0;

        return [
            'total_new_customers' => $totalNewCustomers,
            'acquisition_cost' => (float) $acquisitionCost,
            'daily_acquisition' => $acquisitionData->map(function ($item) {
                return [
                    'date' => $item->date,
                    'new_customers' => (int) $item->new_customers,
                ];
            }),
        ];
    }

    /**
     * Get customer retention data.
     */
    private function getCustomerRetention($companyId, $dateRange)
    {
        // Customers who made repeat purchases
        $repeatCustomers = Customer::where('company_id', $companyId)
            ->whereHas('orders', function ($query) use ($dateRange) {
                $query->whereBetween('created_at', [$dateRange['from'], $dateRange['to']]);
            }, '>', 1)
            ->count();

        $totalCustomersWithOrders = Customer::where('company_id', $companyId)
            ->whereHas('orders', function ($query) use ($dateRange) {
                $query->whereBetween('created_at', [$dateRange['from'], $dateRange['to']]);
            })
            ->count();

        $retentionRate = $totalCustomersWithOrders > 0 
            ? round(($repeatCustomers / $totalCustomersWithOrders) * 100, 2)
            : 0;

        // Churn rate (customers who haven't ordered in the last 60 days)
        $activeCustomers = Customer::where('company_id', $companyId)
            ->whereHas('orders', function ($query) {
                $query->where('created_at', '>=', Carbon::now()->subDays(60));
            })
            ->count();

        $totalCustomers = Customer::where('company_id', $companyId)->count();
        $churnRate = $totalCustomers > 0 
            ? round((($totalCustomers - $activeCustomers) / $totalCustomers) * 100, 2)
            : 0;

        return [
            'retention_rate' => $retentionRate,
            'churn_rate' => $churnRate,
            'repeat_customers' => $repeatCustomers,
            'total_customers_with_orders' => $totalCustomersWithOrders,
        ];
    }

    /**
     * Get customer lifetime value.
     */
    private function getCustomerLifetimeValue($companyId)
    {
        $customerMetrics = Customer::where('company_id', $companyId)
            ->selectRaw('
                AVG(total_spend) as avg_lifetime_value,
                AVG(total_orders) as avg_orders_per_customer,
                MAX(total_spend) as highest_lifetime_value
            ')
            ->first();

        $topCustomers = Customer::where('company_id', $companyId)
            ->orderBy('total_spend', 'desc')
            ->limit(10)
            ->get([
                'id',
                DB::raw("CASE
                    WHEN LOWER(COALESCE(customer_type, '')) IN ('business', 'company')
                        AND NULLIF(TRIM(business_name), '') IS NOT NULL
                    THEN business_name
                    ELSE name
                END as name"),
                'total_spend',
                'total_orders',
            ]);

        return [
            'avg_lifetime_value' => (float) ($customerMetrics->avg_lifetime_value ?? 0),
            'avg_orders_per_customer' => (float) ($customerMetrics->avg_orders_per_customer ?? 0),
            'highest_lifetime_value' => (float) ($customerMetrics->highest_lifetime_value ?? 0),
            'top_customers' => $topCustomers->map(function ($customer) {
                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'lifetime_value' => (float) $customer->total_spend,
                    'total_orders' => (int) $customer->total_orders,
                ];
            }),
        ];
    }

    /**
     * Get top customers.
     */
    private function getTopCustomers($companyId, $dateRange)
    {
        return DB::table('customers')
            ->join('orders', 'customers.id', '=', 'orders.customer_id')
            ->where('customers.company_id', $companyId)
            ->whereBetween('orders.created_at', [$dateRange['from'], $dateRange['to']])
            ->selectRaw('
                customers.id,
                CASE
                    WHEN LOWER(COALESCE(customers.customer_type, \'\')) IN (\'business\', \'company\')
                        AND NULLIF(TRIM(customers.business_name), \'\') IS NOT NULL
                    THEN customers.business_name
                    ELSE customers.name
                END as name,
                customers.email,
                SUM(orders.final_amount) as total_spent,
                COUNT(orders.id) as order_count,
                AVG(orders.final_amount) as avg_order_value
            ')
            ->groupBy(
                'customers.id',
                'customers.name',
                'customers.email',
                'customers.customer_type',
                'customers.business_name'
            )
            ->orderBy('total_spent', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($customer) {
                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'total_spent' => (float) $customer->total_spent,
                    'order_count' => (int) $customer->order_count,
                    'avg_order_value' => (float) $customer->avg_order_value,
                ];
            });
    }

    /**
     * Get customer segments.
     */
    private function getCustomerSegments($companyId)
    {
        $segments = [
            'high_value' => Customer::where('company_id', $companyId)
                ->where('total_spend', '>', 10000)
                ->count(),
            'medium_value' => Customer::where('company_id', $companyId)
                ->whereBetween('total_spend', [1000, 10000])
                ->count(),
            'low_value' => Customer::where('company_id', $companyId)
                ->whereBetween('total_spend', [1, 999])
                ->count(),
            'new_customers' => Customer::where('company_id', $companyId)
                ->where('total_spend', 0)
                ->count(),
        ];

        return $segments;
    }

    // ===========================================
    // INVENTORY ANALYTICS METHODS
    // ===========================================

    /**
     * Get inventory levels.
     */
    private function getInventoryLevels($companyId)
    {
        // Single round-trip: totals plus the stock-distribution buckets via conditional SUMs,
        // instead of two separate queries (matters on a high-latency DB connection).
        $inventoryData = Product::where('company_id', $companyId)
            ->selectRaw('
                COUNT(*) as total_products,
                SUM(stock_quantity) as total_stock,
                SUM(stock_quantity * unit_cost) as total_value,
                AVG(stock_quantity) as avg_stock_per_product,
                SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock,
                SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock,
                SUM(CASE WHEN stock_quantity > low_stock_threshold AND stock_quantity <= (low_stock_threshold * 2) THEN 1 ELSE 0 END) as medium_stock,
                SUM(CASE WHEN stock_quantity > (low_stock_threshold * 2) THEN 1 ELSE 0 END) as high_stock
            ')
            ->first();

        $stockDistribution = collect([
            'out_of_stock' => (int) ($inventoryData->out_of_stock ?? 0),
            'low_stock' => (int) ($inventoryData->low_stock ?? 0),
            'medium_stock' => (int) ($inventoryData->medium_stock ?? 0),
            'high_stock' => (int) ($inventoryData->high_stock ?? 0),
        ])->filter(fn ($count) => $count > 0);

        return [
            'total_products' => (int) ($inventoryData->total_products ?? 0),
            'total_stock_units' => (int) ($inventoryData->total_stock ?? 0),
            'total_inventory_value' => (float) ($inventoryData->total_value ?? 0),
            'avg_stock_per_product' => (float) ($inventoryData->avg_stock_per_product ?? 0),
            'stock_distribution' => $stockDistribution,
        ];
    }

    /**
     * Get stock alerts.
     */
    private function getStockAlerts($companyId)
    {
        // Single round-trip for both buckets, split client-side afterwards.
        $alertProducts = Product::where('company_id', $companyId)
            ->where(function ($query) {
                $query->where('stock_quantity', 0)
                    ->orWhereRaw('stock_quantity > 0 AND stock_quantity <= low_stock_threshold');
            })
            ->select('id', 'name', 'sku', 'stock_quantity', 'low_stock_threshold')
            ->orderBy('stock_quantity')
            ->get();

        $lowStockProducts = $alertProducts->filter(fn ($p) => $p->stock_quantity > 0)->values();
        $outOfStockProducts = $alertProducts->filter(fn ($p) => $p->stock_quantity == 0)->values();

        return [
            'low_stock_products' => $lowStockProducts,
            'out_of_stock_products' => $outOfStockProducts,
            'low_stock_count' => $lowStockProducts->count(),
            'out_of_stock_count' => $outOfStockProducts->count(),
        ];
    }

    /**
     * Get inventory turnover.
     */
    private function getInventoryTurnover($companyId)
    {
        $last12Months = Carbon::now()->subMonths(12);
        
        $turnoverData = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $companyId)
            ->where('orders.created_at', '>=', $last12Months)
            ->selectRaw('
                products.id,
                products.name,
                products.stock_quantity,
                SUM(order_items.quantity) as total_sold,
                CASE 
                    WHEN products.stock_quantity > 0 
                    THEN SUM(order_items.quantity) / products.stock_quantity 
                    ELSE 0 
                END as turnover_ratio
            ')
            ->groupBy('products.id', 'products.name', 'products.stock_quantity')
            ->orderBy('turnover_ratio', 'desc')
            ->limit(20)
            ->get();

        return $turnoverData->map(function ($item) {
            return [
                'product_id' => $item->id,
                'product_name' => $item->name,
                'current_stock' => (int) $item->stock_quantity,
                'units_sold_12m' => (int) $item->total_sold,
                'turnover_ratio' => (float) $item->turnover_ratio,
            ];
        });
    }

    /**
     * Get dead stock analysis.
     */
    private function getDeadStock($companyId)
    {
        $deadStockThreshold = Carbon::now()->subMonths(6);

        // Dead stock: products with stock but no sales in the last 6 months.
        // whereNotIn with a subquery keeps this to a single round-trip instead of two.
        $deadStockProducts = Product::where('company_id', $companyId)
            ->where('stock_quantity', '>', 0)
            ->whereNotIn('id', function ($query) use ($companyId, $deadStockThreshold) {
                $query->select('order_items.product_id')
                    ->from('order_items')
                    ->join('orders', 'order_items.order_id', '=', 'orders.id')
                    ->where('orders.company_id', $companyId)
                    ->where('orders.created_at', '>=', $deadStockThreshold);
            })
            ->selectRaw('
                id, name, sku, stock_quantity, unit_cost,
                (stock_quantity * unit_cost) as dead_stock_value
            ')
            ->orderBy('dead_stock_value', 'desc')
            ->get();

        $totalDeadStockValue = $deadStockProducts->sum('dead_stock_value');

        return [
            'dead_stock_products' => $deadStockProducts->take(20),
            'total_dead_stock_value' => (float) $totalDeadStockValue,
            'dead_stock_count' => $deadStockProducts->count(),
        ];
    }

    /**
     * Get product performance analysis.
     */
    private function getProductPerformance($companyId)
    {
        $last30Days = Carbon::now()->subDays(30);
        
        $topPerformers = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.company_id', $companyId)
            ->where('orders.created_at', '>=', $last30Days)
            ->selectRaw('
                products.id,
                products.name,
                SUM(order_items.quantity) as total_sold,
                SUM(order_items.quantity * order_items.unit_price) as total_revenue,
                COUNT(DISTINCT orders.id) as order_frequency
            ')
            ->groupBy('products.id', 'products.name')
            ->orderBy('total_revenue', 'desc')
            ->limit(10)
            ->get();

        // Slow movers: products with stock, but less than 2 sales in the last 30 days
        $slowMovers = Product::where('products.company_id', $companyId)
            ->where('products.stock_quantity', '>', 0)
            ->leftJoin('order_items', function($join) use ($last30Days) {
                $join->on('products.id', '=', 'order_items.product_id');
            })
            ->leftJoin('orders', function($join) use ($last30Days) {
                $join->on('order_items.order_id', '=', 'orders.id')
                    ->where('orders.created_at', '>=', $last30Days);
            })
            ->groupBy('products.id', 'products.name', 'products.stock_quantity', 'products.unit_cost')
            ->selectRaw('
                products.id,
                products.name,
                products.stock_quantity,
                products.unit_cost,
                COUNT(DISTINCT orders.id) as recent_order_count
            ')
            ->havingRaw('COUNT(DISTINCT orders.id) < 2')
            ->orderBy('recent_order_count', 'asc')
            ->limit(10)
            ->get();

        return [
            'top_performers' => $topPerformers->map(function ($item) {
                return [
                    'product_id' => $item->id,
                    'product_name' => $item->name,
                    'units_sold' => (int) $item->total_sold,
                    'revenue' => (float) $item->total_revenue,
                    'order_frequency' => (int) $item->order_frequency,
                ];
            }),
            'slow_movers' => $slowMovers,
        ];
    }
}
