<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Grant the Accountant role full access to Dashboard and Inventory modules
     * (view, create, update, delete) including products, stock counts, serial
     * numbers, stores, categories, breakages, repairs, product receipts, and
     * stock adjustments.
     */
    private const PERMISSION_KEYS = [
        // Dashboard
        'can_view_dashboard',
        'can_view_dashboard_menu',
        'can_view_sales_overview',
        'can_view_inventory_overview',

        // Inventory menu
        'can_view_inventory_menu',
        'can_view_inventory',
        'can_manage_inventory',
        'can_create_inventory',
        'can_update_inventory',

        // Products (full CRUD — accountant previously had view-only)
        'can_create_products',
        'can_update_products',
        'can_delete_products',
        'can_view_product_categories',
        'can_create_product_categories',
        'can_update_product_categories',
        'can_delete_product_categories',

        // Stock counts
        'can_view_stock_counts_menu',
        'can_view_stock_counts',
        'can_create_stock_counts',
        'can_update_stock_counts',
        'can_delete_stock_counts',
        'can_manage_stock_counts',

        // Serial numbers
        'can_view_serial_numbers_menu',
        'can_view_serial_numbers',
        'can_create_serial_numbers',
        'can_update_serial_numbers',
        'can_delete_serial_numbers',
        'can_assign_serial_numbers_to_batches',

        // Stores
        'can_view_stores',
        'can_create_stores',
        'can_update_stores',
        'can_delete_stores',

        // Categories
        'can_view_categories',
        'can_create_categories',
        'can_update_categories',
        'can_delete_categories',

        // Product receipts
        'can_view_product_receipt_menu',
        'can_view_product_receipts',
        'can_create_product_receipts',

        // Breakages
        'can_view_breakages_menu',
        'can_view_breakages',
        'can_create_breakages',
        'can_update_breakages',
        'can_delete_breakages',
        'can_approve_breakages',
        'can_replace_breakage_items',

        // Repairs
        'can_view_repairs_menu',
        'can_view_repairs',
        'can_create_repairs',
        'can_update_repairs',
        'can_delete_repairs',
        'can_approve_repairs',
        'can_complete_repairs',
        'can_dispatch_repaired_items',

        // Stock adjustments
        'can_approve_adjustments',
        'can_adjust_closing_stock',

        // Inventory reports
        'can_view_inventory_reports',
        'can_view_reports',
    ];

    public function up(): void
    {
        Permission::firstOrCreate(
            ['key' => 'can_view_dashboard_menu'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'View Dashboard Menu',
                'description' => 'Access to the dashboard section in the main navigation menu',
                'category' => 'Menu Permissions',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        $permissions = Permission::whereIn('key', self::PERMISSION_KEYS)->get();
        $syncData = $permissions->mapWithKeys(fn (Permission $perm) => [$perm->id => ['granted_at' => now()]])->toArray();

        Role::where('name', 'Accountant')->each(function (Role $role) use ($syncData) {
            $role->permissions()->syncWithoutDetaching($syncData);
        });
    }

    public function down(): void
    {
        $permissions = Permission::whereIn('key', self::PERMISSION_KEYS)->get();
        $permissionIds = $permissions->pluck('id')->toArray();

        Role::where('name', 'Accountant')->each(function (Role $role) use ($permissionIds) {
            $role->permissions()->detach($permissionIds);
        });
    }
};
