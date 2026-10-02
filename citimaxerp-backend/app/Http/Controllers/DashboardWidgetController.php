<?php

namespace App\Http\Controllers;

use App\Models\DashboardWidget;
use App\Models\DashboardConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DashboardWidgetController extends Controller
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
     * Get available widget types and their configurations.
     */
    public function getWidgetTypes(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view dashboard widgets.',
            ], 403);
        }

        $widgetTypes = [
            'sales_overview' => [
                'name' => 'Sales Overview',
                'description' => 'Key sales metrics and performance indicators',
                'category' => 'sales',
                'default_size' => 'medium',
                'configurable_options' => [
                    'show_comparison' => 'boolean',
                    'comparison_period' => ['previous_month', 'previous_quarter', 'previous_year'],
                    'currency' => 'string',
                ],
                'required_permissions' => ['can_view_orders'],
            ],
            'revenue_chart' => [
                'name' => 'Revenue Chart',
                'description' => 'Revenue trends over time',
                'category' => 'sales',
                'default_size' => 'large',
                'configurable_options' => [
                    'chart_type' => ['line', 'bar', 'area'],
                    'period' => ['last_30_days', 'last_3_months', 'last_6_months', 'last_12_months'],
                    'group_by' => ['day', 'week', 'month'],
                ],
                'required_permissions' => ['can_view_orders'],
            ],
            'top_products' => [
                'name' => 'Top Products',
                'description' => 'Best selling products by revenue or quantity',
                'category' => 'inventory',
                'default_size' => 'medium',
                'configurable_options' => [
                    'limit' => 'number',
                    'metric' => ['revenue', 'quantity', 'orders'],
                    'period' => ['last_7_days', 'last_30_days', 'last_90_days'],
                ],
                'required_permissions' => ['can_view_products'],
            ],
            'customer_insights' => [
                'name' => 'Customer Insights',
                'description' => 'Customer acquisition and retention metrics',
                'category' => 'customers',
                'default_size' => 'medium',
                'configurable_options' => [
                    'show_new_customers' => 'boolean',
                    'show_repeat_customers' => 'boolean',
                    'period' => ['last_30_days', 'last_90_days'],
                ],
                'required_permissions' => ['can_view_customers'],
            ],
            'expense_summary' => [
                'name' => 'Expense Summary',
                'description' => 'Expense breakdown and trends',
                'category' => 'finance',
                'default_size' => 'medium',
                'configurable_options' => [
                    'show_by_category' => 'boolean',
                    'period' => ['current_month', 'last_month', 'last_quarter'],
                ],
                'required_permissions' => ['can_view_expenses'],
            ],
            'cash_flow' => [
                'name' => 'Cash Flow',
                'description' => 'Cash inflow and outflow analysis',
                'category' => 'finance',
                'default_size' => 'large',
                'configurable_options' => [
                    'show_trend' => 'boolean',
                    'period' => ['last_3_months', 'last_6_months', 'last_12_months'],
                ],
                'required_permissions' => ['can_view_payments'],
            ],
            'inventory_alerts' => [
                'name' => 'Inventory Alerts',
                'description' => 'Low stock and out of stock alerts',
                'category' => 'inventory',
                'default_size' => 'medium',
                'configurable_options' => [
                    'show_low_stock' => 'boolean',
                    'show_out_of_stock' => 'boolean',
                    'threshold_days' => 'number',
                ],
                'required_permissions' => ['can_view_products'],
            ],
            'recent_orders' => [
                'name' => 'Recent Orders',
                'description' => 'Latest orders and their status',
                'category' => 'sales',
                'default_size' => 'medium',
                'configurable_options' => [
                    'limit' => 'number',
                    'show_status' => 'boolean',
                ],
                'required_permissions' => ['can_view_orders'],
            ],
            'payment_methods' => [
                'name' => 'Payment Methods',
                'description' => 'Payment method breakdown and trends',
                'category' => 'finance',
                'default_size' => 'small',
                'configurable_options' => [
                    'chart_type' => ['pie', 'donut', 'bar'],
                    'period' => ['last_30_days', 'last_90_days'],
                ],
                'required_permissions' => ['can_view_payments'],
            ],
            'customer_lifetime_value' => [
                'name' => 'Customer Lifetime Value',
                'description' => 'Top customers by lifetime value',
                'category' => 'customers',
                'default_size' => 'medium',
                'configurable_options' => [
                    'limit' => 'number',
                    'show_segments' => 'boolean',
                ],
                'required_permissions' => ['can_view_customers'],
            ],
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Widget types retrieved successfully.',
            'data' => $widgetTypes,
        ], 200);
    }

    /**
     * Get widgets for a company.
     */
    public function index(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view dashboard widgets.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = DashboardWidget::forCompany($user->company_id)
                ->with(['createdBy']);

            // Filter by widget type
            if ($request->filled('widget_type')) {
                $query->where('widget_type', $request->input('widget_type'));
            }

            // Filter by active status
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            // Filter by system vs custom widgets
            if ($request->has('is_system_widget')) {
                $query->where('is_system_widget', $request->boolean('is_system_widget'));
            }

            $widgets = $query->orderBy('widget_type')->get();

            // Filter widgets based on user permissions
            $userPermissions = $user->role->permissions ?? [];
            $filteredWidgets = $widgets->filter(function ($widget) use ($userPermissions) {
                return $widget->hasPermission($userPermissions);
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard widgets retrieved successfully.',
                'data' => $filteredWidgets->values(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve dashboard widgets', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve dashboard widgets: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new widget.
     */
    public function store(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create dashboard widgets.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'widget_type' => 'required|string|max:255',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'configuration' => 'nullable|array',
            'size' => 'sometimes|string|in:small,medium,large,full',
            'position_x' => 'sometimes|integer|min:0',
            'position_y' => 'sometimes|integer|min:0',
            'permissions' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();

            $widget = DashboardWidget::create([
                'company_id' => $user->company_id,
                'widget_type' => $request->input('widget_type'),
                'title' => $request->input('title'),
                'description' => $request->input('description'),
                'configuration' => $request->input('configuration', []),
                'size' => $request->input('size', 'medium'),
                'position_x' => $request->input('position_x', 0),
                'position_y' => $request->input('position_y', 0),
                'permissions' => $request->input('permissions', []),
                'is_system_widget' => false,
                'created_by' => $user->id,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard widget created successfully.',
                'data' => $widget->load(['createdBy']),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create dashboard widget', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create dashboard widget: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show a specific widget.
     */
    public function show(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view dashboard widgets.',
            ], 403);
        }

        try {
            $user = $request->user();
            $widget = DashboardWidget::forCompany($user->company_id)
                ->with(['createdBy'])
                ->find($id);

            if (!$widget) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Widget not found.',
                ], 404);
            }

            // Check if user has permission to view this widget
            $userPermissions = $user->role->permissions ?? [];
            if (!$widget->hasPermission($userPermissions)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Insufficient permissions to view this widget.',
                ], 403);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard widget retrieved successfully.',
                'data' => $widget,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve dashboard widget', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve dashboard widget: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a widget.
     */
    public function update(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update dashboard widgets.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'configuration' => 'sometimes|array',
            'size' => 'sometimes|string|in:small,medium,large,full',
            'position_x' => 'sometimes|integer|min:0',
            'position_y' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $widget = DashboardWidget::forCompany($user->company_id)->find($id);

            if (!$widget) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Widget not found.',
                ], 404);
            }

            // Only allow updating custom widgets or if user created the widget
            if ($widget->is_system_widget && $widget->created_by !== $user->id) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot modify system widgets.',
                ], 403);
            }

            $widget->update($request->only([
                'title',
                'description',
                'configuration',
                'size',
                'position_x',
                'position_y',
                'is_active',
            ]));

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard widget updated successfully.',
                'data' => $widget->fresh(['createdBy']),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update dashboard widget', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update dashboard widget: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a widget.
     */
    public function destroy(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete dashboard widgets.',
            ], 403);
        }

        try {
            $user = $request->user();
            $widget = DashboardWidget::forCompany($user->company_id)->find($id);

            if (!$widget) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Widget not found.',
                ], 404);
            }

            // Only allow deleting custom widgets or if user created the widget
            if ($widget->is_system_widget) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete system widgets.',
                ], 403);
            }

            $widget->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard widget deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete dashboard widget', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete dashboard widget: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get widget data for rendering.
     */
    public function getWidgetData(Request $request, $id)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view widget data.',
            ], 403);
        }

        try {
            $user = $request->user();
            $widget = DashboardWidget::forCompany($user->company_id)->find($id);

            if (!$widget) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Widget not found.',
                ], 404);
            }

            // Check if user has permission to view this widget
            $userPermissions = $user->role->permissions ?? [];
            if (!$widget->hasPermission($userPermissions)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Insufficient permissions to view this widget.',
                ], 403);
            }

            // Get widget data based on widget type
            $data = $this->generateWidgetData($widget, $user->company_id, $request);

            return response()->json([
                'status' => 'success',
                'message' => 'Widget data retrieved successfully.',
                'data' => [
                    'widget' => $widget,
                    'data' => $data,
                    'last_updated' => now(),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve widget data', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve widget data: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Initialize default widgets for a company.
     */
    public function initializeDefaultWidgets(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_dashboard')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to initialize widgets.',
            ], 403);
        }

        try {
            $user = $request->user();
            $companyId = $user->company_id;

            // Check if widgets already exist
            $existingWidgets = DashboardWidget::forCompany($companyId)->count();
            if ($existingWidgets > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Default widgets already exist for this company.',
                ], 400);
            }

            $defaultWidgets = [
                [
                    'widget_type' => 'sales_overview',
                    'title' => 'Sales Overview',
                    'description' => 'Key sales metrics and performance',
                    'size' => 'large',
                    'position_x' => 0,
                    'position_y' => 0,
                    'permissions' => ['can_view_orders'],
                ],
                [
                    'widget_type' => 'revenue_chart',
                    'title' => 'Revenue Trend',
                    'description' => 'Revenue over time',
                    'size' => 'large',
                    'position_x' => 6,
                    'position_y' => 0,
                    'permissions' => ['can_view_orders'],
                ],
                [
                    'widget_type' => 'recent_orders',
                    'title' => 'Recent Orders',
                    'description' => 'Latest customer orders',
                    'size' => 'medium',
                    'position_x' => 0,
                    'position_y' => 2,
                    'permissions' => ['can_view_orders'],
                ],
                [
                    'widget_type' => 'top_products',
                    'title' => 'Top Products',
                    'description' => 'Best selling products',
                    'size' => 'medium',
                    'position_x' => 4,
                    'position_y' => 2,
                    'permissions' => ['can_view_products'],
                ],
                [
                    'widget_type' => 'inventory_alerts',
                    'title' => 'Inventory Alerts',
                    'description' => 'Stock level warnings',
                    'size' => 'medium',
                    'position_x' => 8,
                    'position_y' => 2,
                    'permissions' => ['can_view_products'],
                ],
            ];

            $createdWidgets = [];
            foreach ($defaultWidgets as $widgetData) {
                $widget = DashboardWidget::create([
                    'company_id' => $companyId,
                    'widget_type' => $widgetData['widget_type'],
                    'title' => $widgetData['title'],
                    'description' => $widgetData['description'],
                    'size' => $widgetData['size'],
                    'position_x' => $widgetData['position_x'],
                    'position_y' => $widgetData['position_y'],
                    'permissions' => $widgetData['permissions'],
                    'is_system_widget' => true,
                    'created_by' => $user->id,
                ]);
                $createdWidgets[] = $widget;
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Default widgets initialized successfully.',
                'data' => $createdWidgets,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to initialize default widgets', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to initialize default widgets: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate data for specific widget types.
     */
    private function generateWidgetData($widget, $companyId, $request)
    {
        $config = array_merge($widget->getDefaultConfiguration(), $widget->configuration ?? []);

        switch ($widget->widget_type) {
            case 'sales_overview':
                return $this->generateSalesOverviewData($companyId, $config);
            case 'revenue_chart':
                return $this->generateRevenueChartData($companyId, $config);
            case 'top_products':
                return $this->generateTopProductsData($companyId, $config);
            case 'recent_orders':
                return $this->generateRecentOrdersData($companyId, $config);
            case 'inventory_alerts':
                return $this->generateInventoryAlertsData($companyId, $config);
            case 'customer_insights':
                return $this->generateCustomerInsightsData($companyId, $config);
            case 'expense_summary':
                return $this->generateExpenseSummaryData($companyId, $config);
            case 'cash_flow':
                return $this->generateCashFlowData($companyId, $config);
            default:
                return ['message' => 'Widget type not implemented'];
        }
    }

    // Widget data generation methods (simplified for brevity)
    private function generateSalesOverviewData($companyId, $config)
    {
        // Implementation would call DashboardController methods
        return ['placeholder' => 'Sales overview data'];
    }

    private function generateRevenueChartData($companyId, $config)
    {
        return ['placeholder' => 'Revenue chart data'];
    }

    private function generateTopProductsData($companyId, $config)
    {
        return ['placeholder' => 'Top products data'];
    }

    private function generateRecentOrdersData($companyId, $config)
    {
        return ['placeholder' => 'Recent orders data'];
    }

    private function generateInventoryAlertsData($companyId, $config)
    {
        return ['placeholder' => 'Inventory alerts data'];
    }

    private function generateCustomerInsightsData($companyId, $config)
    {
        return ['placeholder' => 'Customer insights data'];
    }

    private function generateExpenseSummaryData($companyId, $config)
    {
        return ['placeholder' => 'Expense summary data'];
    }

    private function generateCashFlowData($companyId, $config)
    {
        return ['placeholder' => 'Cash flow data'];
    }
}
