<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * DispatchController (requisition/warehouse dispatches) gates on the
     * 'can_*_dispatches' permission family - distinct from the separate
     * 'can_*_order_dispatches' family used by OrderDispatchController for
     * sales order fulfillment. Only GM, Director and Warehouse Manager
     * should be able to create a dispatch from an approved requisition;
     * view is granted alongside create so they can also pull the
     * Requisition Note PDF for a dispatch they created.
     */
    private const PERMISSION_KEYS = ['can_view_dispatches', 'can_create_dispatches'];
    private const ROLE_NAMES = ['GM', 'Director', 'Warehouse Manager'];

    public function up(): void
    {
        $permissions = Permission::whereIn('key', self::PERMISSION_KEYS)->get();
        $syncData = $permissions->mapWithKeys(fn (Permission $perm) => [$perm->id => ['granted_at' => now()]])->toArray();

        Role::whereIn('name', self::ROLE_NAMES)->get()->each(function (Role $role) use ($syncData) {
            $role->permissions()->syncWithoutDetaching($syncData);
        });
    }

    public function down(): void
    {
        $permissionIds = Permission::whereIn('key', self::PERMISSION_KEYS)->pluck('id');

        Role::whereIn('name', self::ROLE_NAMES)->get()->each(function (Role $role) use ($permissionIds) {
            $role->permissions()->detach($permissionIds);
        });
    }
};
