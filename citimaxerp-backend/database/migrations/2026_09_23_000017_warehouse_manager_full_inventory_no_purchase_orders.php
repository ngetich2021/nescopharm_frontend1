<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Warehouse Manager should hold every inventory-related permission except
     * two that are deliberately kept out of reach of the role:
     *  - can_manage_all_products: a cross-company bypass, not a "more inventory
     *    rights" permission - granting it would let a per-company Warehouse
     *    Manager see/manage other companies' products.
     *  - can_adjust_closing_stock: its own migration (2026_09_21_000005)
     *    restricts closing-stock adjustments to GM/Director by design.
     * Purchase order access is removed entirely per this request - Warehouse
     * Manager should not view, receive, or otherwise touch purchase orders.
     */
    private const GRANT_KEYS = [
        // Products
        'can_create_products',
        'can_update_products',
        'can_delete_products',
        // Product categories
        'can_create_product_categories',
        'can_update_product_categories',
        'can_delete_product_categories',
        // Generic categories (separate permission group, same feature area)
        'can_create_categories',
        'can_view_categories',
        'can_update_categories',
        'can_delete_categories',
        // Product receipts
        'can_delete_product_receipts',
        // Stock counts / adjustments
        'can_create_stock_counts',
        'can_delete_stock_counts',
        'can_approve_adjustments',
        // Serial numbers
        'can_view_serial_numbers',
        'can_view_serial_numbers_menu',
        'can_create_serial_numbers',
        'can_update_serial_numbers',
        'can_delete_serial_numbers',
        'can_assign_serial_numbers_to_batches',
    ];

    private const REVOKE_KEYS = [
        'can_view_purchase_orders',
        'can_view_purchase_orders_menu',
        'can_receive_purchase_orders',
        'can_create_purchase_orders',
        'can_update_purchase_orders',
        'can_delete_purchase_orders',
        'can_manage_all_purchase_orders',
    ];

    public function up(): void
    {
        $grantIds = Permission::whereIn('key', self::GRANT_KEYS)->pluck('id');
        $grantSync = $grantIds->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->toArray();

        $revokeIds = Permission::whereIn('key', self::REVOKE_KEYS)->pluck('id');

        Role::where('name', 'Warehouse Manager')->get()->each(function (Role $role) use ($grantSync, $revokeIds) {
            $role->permissions()->syncWithoutDetaching($grantSync);
            $role->permissions()->detach($revokeIds);
        });
    }

    public function down(): void
    {
        // Not reversible - re-tightening/re-loosening a runtime role's
        // permissions after the fact could silently break access that now
        // depends on this change.
    }
};
