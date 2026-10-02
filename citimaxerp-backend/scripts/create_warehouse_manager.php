<?php

/**
 * One-time setup: create a "Warehouse Manager" role (flagged is_warehouse_incharge
 * so it's assignable to stock counts) with sensible warehouse-scoped permissions,
 * and a placeholder user account for it.
 *
 * Run with: php artisan tinker --execute="require base_path('scripts/create_warehouse_manager.php');"
 */

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Str;

$company = Company::where('name', 'Nescopharm')->first();
if (!$company) {
    echo "Company 'Nescopharm' not found - aborting.\n";
    return;
}

$permissionKeys = [
    'can_view_products',
    'can_view_products_menu',
    'can_view_product_categories',
    'can_view_inventory',
    'can_create_inventory',
    'can_update_inventory',
    'can_view_inventory_menu',
    'can_manage_inventory',
    'can_view_stock_counts',
    'can_update_stock_counts',
    'can_view_stock_counts_menu',
    'can_manage_stock_counts',
    'can_view_product_receipts',
    'can_create_product_receipts',
    'can_update_product_receipts',
    'can_view_product_receipt_menu',
    'can_view_purchase_orders',
    'can_receive_purchase_orders',
    'can_view_purchase_orders_menu',
];

$role = Role::where('company_id', $company->id)
    ->whereRaw('LOWER(name) = ?', ['warehouse manager'])
    ->first();

if (!$role) {
    $role = Role::create([
        'id' => (string) Str::uuid(),
        'company_id' => $company->id,
        'name' => 'Warehouse Manager',
        'description' => 'Manages warehouse operations: stock counts, product receiving, and inventory.',
        'is_active' => true,
        'is_warehouse_incharge' => true,
    ]);
    echo "Created role: Warehouse Manager ({$role->id})\n";
} else {
    $role->is_warehouse_incharge = true;
    $role->save();
    echo "Role 'Warehouse Manager' already existed ({$role->id}) - ensured is_warehouse_incharge = true.\n";
}

$permissionIds = Permission::whereIn('key', $permissionKeys)->pluck('id', 'key');
$missing = array_diff($permissionKeys, $permissionIds->keys()->toArray());
if (!empty($missing)) {
    echo "Warning - permission keys not found in DB: " . implode(', ', $missing) . "\n";
}

foreach ($permissionIds as $key => $permissionId) {
    $role->permissions()->syncWithoutDetaching([$permissionId => ['granted_at' => now()]]);
}
echo "Granted " . count($permissionIds) . " permissions to Warehouse Manager role.\n";

$email = 'warehouse.manager@nescopharma.com';
$user = User::where('email', $email)->first();

if ($user) {
    echo "User {$email} already exists - updating role to Warehouse Manager.\n";
    $user->role_id = $role->id;
    $user->save();
} else {
    $passwordSetupToken = Str::random(64);
    $user = User::create([
        'id' => (string) Str::uuid(),
        'company_id' => $company->id,
        'email' => $email,
        'first_name' => 'Warehouse',
        'last_name' => 'Manager',
        'phone' => null,
        'password' => bcrypt(Str::random(32)), // placeholder - must be reset via password_setup_token
        'role_id' => $role->id,
        'is_active' => true,
        'email_verified' => false,
        'password_setup_token' => $passwordSetupToken,
        'password_setup_token_expires_at' => now()->addDays(7),
    ]);
    echo "Created user: {$email} ({$user->id})\n";
    echo "Password setup token (valid 7 days): {$passwordSetupToken}\n";
}

echo "Done.\n";
