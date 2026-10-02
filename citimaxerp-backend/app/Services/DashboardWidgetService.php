<?php

namespace App\Services;

use App\Models\DashboardWidget;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class DashboardWidgetService
{
    /**
     * Get all available widget types with their configurations
     * This is the single source of truth for widget types
     */
    public static function getAvailableWidgetTypes(): array
    {
        return [
            'sales_overview' => [
                'name' => 'Sales Overview',
                'description' => 'Key sales metrics and performance indicators',
                'category' => 'sales',
                'default_size' => 'large',
                'default_position' => ['x' => 0, 'y' => 0],
                'configurable_options' => [
                    'show_comparison' => 'boolean',
                    'comparison_period' => ['previous_month', 'previous_quarter', 'previous_year'],
                    'currency' => 'string',
                ],
                'default_configuration' => [
                    'show_comparison' => true,
                    'comparison_period' => 'previous_month',
                    'currency' => 'KES',
                ],
                'required_permissions' => ['can_view_orders'],
                'is_system_widget' => true,
                'priority' => 1,
            ],
            'revenue_chart' => [
                'name' => 'Revenue Chart',
                'description' => 'Revenue trends over time',
                'category' => 'sales',
                'default_size' => 'large',
                'default_position' => ['x' => 6, 'y' => 0],
                'configurable_options' => [
                    'chart_type' => ['line', 'bar', 'area'],
                    'period' => ['last_30_days', 'last_3_months', 'last_6_months', 'last_12_months'],
                    'group_by' => ['day', 'week', 'month'],
                ],
                'default_configuration' => [
                    'chart_type' => 'line',
                    'period' => 'last_12_months',
                    'group_by' => 'month',
                ],
                'required_permissions' => ['can_view_orders'],
                'is_system_widget' => true,
                'priority' => 2,
            ],
            'recent_orders' => [
                'name' => 'Recent Orders',
                'description' => 'Latest orders and their status',
                'category' => 'sales',
                'default_size' => 'medium',
                'default_position' => ['x' => 0, 'y' => 2],
                'configurable_options' => [
                    'limit' => 'number',
                    'show_status' => 'boolean',
                ],
                'default_configuration' => [
                    'limit' => 10,
                    'show_status' => true,
                ],
                'required_permissions' => ['can_view_orders'],
                'is_system_widget' => true,
                'priority' => 3,
            ],
            'top_products' => [
                'name' => 'Top Products',
                'description' => 'Best selling products by revenue or quantity',
                'category' => 'inventory',
                'default_size' => 'medium',
                'default_position' => ['x' => 4, 'y' => 2],
                'configurable_options' => [
                    'limit' => 'number',
                    'metric' => ['revenue', 'quantity', 'orders'],
                    'period' => ['last_7_days', 'last_30_days', 'last_90_days'],
                ],
                'default_configuration' => [
                    'limit' => 10,
                    'metric' => 'revenue',
                    'period' => 'last_30_days',
                ],
                'required_permissions' => ['can_view_products'],
                'is_system_widget' => true,
                'priority' => 4,
            ],
            'inventory_alerts' => [
                'name' => 'Inventory Alerts',
                'description' => 'Low stock and out of stock alerts',
                'category' => 'inventory',
                'default_size' => 'medium',
                'default_position' => ['x' => 8, 'y' => 2],
                'configurable_options' => [
                    'show_low_stock' => 'boolean',
                    'show_out_of_stock' => 'boolean',
                    'threshold_days' => 'number',
                ],
                'default_configuration' => [
                    'show_low_stock' => true,
                    'show_out_of_stock' => true,
                    'threshold_days' => 7,
                ],
                'required_permissions' => ['can_view_products'],
                'is_system_widget' => true,
                'priority' => 5,
            ],
            'customer_insights' => [
                'name' => 'Customer Insights',
                'description' => 'Customer acquisition and retention metrics',
                'category' => 'customers',
                'default_size' => 'medium',
                'default_position' => ['x' => 0, 'y' => 4],
                'configurable_options' => [
                    'show_new_customers' => 'boolean',
                    'show_repeat_customers' => 'boolean',
                    'period' => ['last_30_days', 'last_90_days'],
                ],
                'default_configuration' => [
                    'show_new_customers' => true,
                    'show_repeat_customers' => true,
                    'period' => 'last_30_days',
                ],
                'required_permissions' => ['can_view_customers'],
                'is_system_widget' => true,
                'priority' => 6,
            ],
            'expense_summary' => [
                'name' => 'Expense Summary',
                'description' => 'Expense breakdown and trends',
                'category' => 'finance',
                'default_size' => 'medium',
                'default_position' => ['x' => 4, 'y' => 4],
                'configurable_options' => [
                    'show_by_category' => 'boolean',
                    'period' => ['current_month', 'last_month', 'last_quarter'],
                ],
                'default_configuration' => [
                    'show_by_category' => true,
                    'period' => 'current_month',
                ],
                'required_permissions' => ['can_view_expenses'],
                'is_system_widget' => true,
                'priority' => 7,
            ],
            'cash_flow' => [
                'name' => 'Cash Flow',
                'description' => 'Cash inflow and outflow analysis',
                'category' => 'finance',
                'default_size' => 'medium',
                'default_position' => ['x' => 8, 'y' => 4],
                'configurable_options' => [
                    'show_trend' => 'boolean',
                    'period' => ['last_3_months', 'last_6_months', 'last_12_months'],
                ],
                'default_configuration' => [
                    'show_trend' => true,
                    'period' => 'last_6_months',
                ],
                'required_permissions' => ['can_view_payments'],
                'is_system_widget' => true,
                'priority' => 8,
            ],
            'payment_methods' => [
                'name' => 'Payment Methods',
                'description' => 'Payment method breakdown and trends',
                'category' => 'finance',
                'default_size' => 'small',
                'default_position' => ['x' => 0, 'y' => 6],
                'configurable_options' => [
                    'chart_type' => ['pie', 'donut', 'bar'],
                    'period' => ['last_30_days', 'last_90_days'],
                ],
                'default_configuration' => [
                    'chart_type' => 'pie',
                    'period' => 'last_30_days',
                ],
                'required_permissions' => ['can_view_payments'],
                'is_system_widget' => true,
                'priority' => 9,
            ],
            'customer_lifetime_value' => [
                'name' => 'Customer Lifetime Value',
                'description' => 'Top customers by lifetime value',
                'category' => 'customers',
                'default_size' => 'medium',
                'default_position' => ['x' => 3, 'y' => 6],
                'configurable_options' => [
                    'limit' => 'number',
                    'show_segments' => 'boolean',
                ],
                'default_configuration' => [
                    'limit' => 15,
                    'show_segments' => true,
                ],
                'required_permissions' => ['can_view_customers'],
                'is_system_widget' => true,
                'priority' => 10,
            ],
        ];
    }

    /**
     * Create default widgets for a company
     */
    public static function createDefaultWidgetsForCompany(string $companyId): bool
    {
        try {
            $company = Company::find($companyId);
            if (!$company) {
                throw new \Exception("Company not found: {$companyId}");
            }

            // Check if widgets already exist
            $existingCount = DashboardWidget::where('company_id', $companyId)->count();
            if ($existingCount > 0) {
                Log::info("Widgets already exist for company", [
                    'company_id' => $companyId, 
                    'count' => $existingCount
                ]);
                return false;
            }

            // Find admin user
            $adminUser = User::where('company_id', $companyId)
                ->whereHas('role', function ($query) {
                    $query->where('name', 'super_admin')->orWhere('name', 'admin');
                })
                ->first();

            if (!$adminUser) {
                $adminUser = User::where('company_id', $companyId)->first();
            }

            if (!$adminUser) {
                throw new \Exception("No users found for company: {$companyId}");
            }

            $availableWidgets = self::getAvailableWidgetTypes();
            $sortedWidgets = collect($availableWidgets)->sortBy('priority');

            foreach ($sortedWidgets as $widgetType => $widgetData) {
                DashboardWidget::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'widget_type' => $widgetType,
                    'title' => $widgetData['name'],
                    'description' => $widgetData['description'],
                    'configuration' => $widgetData['default_configuration'],
                    'size' => $widgetData['default_size'],
                    'position_x' => $widgetData['default_position']['x'],
                    'position_y' => $widgetData['default_position']['y'],
                    'is_active' => true,
                    'is_system_widget' => $widgetData['is_system_widget'],
                    'permissions' => $widgetData['required_permissions'],
                    'created_by' => $adminUser->id,
                ]);
            }

            Log::info("Dashboard widgets created for company", [
                'company_id' => $companyId,
                'widget_count' => count($availableWidgets)
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to create default widgets for company", [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Add a new widget type to the system
     * This method helps with future widget expansion
     */
    public static function addNewWidgetType(
        string $widgetType,
        array $configuration,
        ?string $companyId = null
    ): bool {
        try {
            // Validate required configuration keys
            $requiredKeys = [
                'name', 'description', 'category', 'default_size', 
                'default_position', 'default_configuration', 'required_permissions'
            ];

            foreach ($requiredKeys as $key) {
                if (!isset($configuration[$key])) {
                    throw new \Exception("Missing required configuration key: {$key}");
                }
            }

            // If companyId is provided, create widget for specific company
            // If not, this is just registering the widget type for future use
            if ($companyId) {
                $company = Company::find($companyId);
                if (!$company) {
                    throw new \Exception("Company not found: {$companyId}");
                }

                $adminUser = User::where('company_id', $companyId)
                    ->whereHas('role', function ($query) {
                        $query->where('name', 'super_admin')->orWhere('name', 'admin');
                    })
                    ->first();

                if (!$adminUser) {
                    $adminUser = User::where('company_id', $companyId)->first();
                }

                if (!$adminUser) {
                    throw new \Exception("No users found for company: {$companyId}");
                }

                DashboardWidget::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'widget_type' => $widgetType,
                    'title' => $configuration['name'],
                    'description' => $configuration['description'],
                    'configuration' => $configuration['default_configuration'],
                    'size' => $configuration['default_size'],
                    'position_x' => $configuration['default_position']['x'],
                    'position_y' => $configuration['default_position']['y'],
                    'is_active' => true,
                    'is_system_widget' => $configuration['is_system_widget'] ?? false,
                    'permissions' => $configuration['required_permissions'],
                    'created_by' => $adminUser->id,
                ]);

                Log::info("New widget type created for company", [
                    'widget_type' => $widgetType,
                    'company_id' => $companyId
                ]);
            }

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to add new widget type", [
                'widget_type' => $widgetType,
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get widget types by category
     */
    public static function getWidgetTypesByCategory(): array
    {
        $widgets = self::getAvailableWidgetTypes();
        $categories = [];

        foreach ($widgets as $type => $config) {
            $category = $config['category'];
            if (!isset($categories[$category])) {
                $categories[$category] = [];
            }
            $categories[$category][$type] = $config;
        }

        return $categories;
    }

    /**
     * Validate widget configuration against widget type schema
     */
    public static function validateWidgetConfiguration(string $widgetType, array $configuration): bool
    {
        $availableWidgets = self::getAvailableWidgetTypes();
        
        if (!isset($availableWidgets[$widgetType])) {
            return false;
        }

        $widgetSchema = $availableWidgets[$widgetType];
        $configurableOptions = $widgetSchema['configurable_options'] ?? [];

        foreach ($configuration as $key => $value) {
            if (!isset($configurableOptions[$key])) {
                continue; // Allow unknown configurations for flexibility
            }

            $optionType = $configurableOptions[$key];
            
            if (is_array($optionType)) {
                // Enum validation
                if (!in_array($value, $optionType)) {
                    return false;
                }
            } elseif ($optionType === 'boolean') {
                if (!is_bool($value)) {
                    return false;
                }
            } elseif ($optionType === 'number') {
                if (!is_numeric($value)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Get default layout for a new dashboard
     */
    public static function getDefaultDashboardLayout(): array
    {
        $widgets = self::getAvailableWidgetTypes();
        $layout = [
            'grid_columns' => 12,
            'widgets' => []
        ];

        foreach ($widgets as $type => $config) {
            $layout['widgets'][] = [
                'widget_type' => $type,
                'position' => $config['default_position'],
                'size' => self::getSizeDefinition($config['default_size']),
                'visible' => true
            ];
        }

        return $layout;
    }

    /**
     * Convert size name to grid dimensions
     */
    private static function getSizeDefinition(string $size): array
    {
        return match($size) {
            'small' => ['width' => 3, 'height' => 2],
            'medium' => ['width' => 4, 'height' => 2],
            'large' => ['width' => 6, 'height' => 2],
            'full' => ['width' => 12, 'height' => 3],
            default => ['width' => 4, 'height' => 2]
        };
    }
}
