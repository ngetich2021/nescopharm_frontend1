<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * The Accountant role has the legacy 'can_dispatch_orders' flag (Orders &
     * Sales category), but OrderDispatchController actually gates on the
     * separate 'can_create_order_dispatches' permission (Dispatch category) -
     * a same-name-different-permission mismatch that left Accountant unable
     * to create a dispatch despite appearing to have order/dispatch access.
     * Granting view/create/update only - approve/delete stay warehouse-only,
     * that's a separate authority question.
     */
    private const PERMISSION_KEYS = [
        'can_view_dispatch_menu', 'can_view_order_dispatches',
        'can_create_order_dispatches', 'can_update_order_dispatches',
    ];

    public function up(): void
    {
        $permissions = Permission::whereIn('key', self::PERMISSION_KEYS)->get();
        $syncData = $permissions->mapWithKeys(fn (Permission $perm) => [$perm->id => ['granted_at' => now()]])->toArray();

        Role::where('name', 'Accountant')->get()->each(function (Role $role) use ($syncData) {
            $role->permissions()->syncWithoutDetaching($syncData);
        });
    }

    public function down(): void
    {
        $permissionIds = Permission::whereIn('key', self::PERMISSION_KEYS)->pluck('id');

        Role::where('name', 'Accountant')->get()->each(function (Role $role) use ($permissionIds) {
            $role->permissions()->detach($permissionIds);
        });
    }
};
