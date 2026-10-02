<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * GM needs to update dispatch status (in_transit → delivered) to
     * oversee goods movement and complete order fulfillment workflows.
     */
    public function up(): void
    {
        $permission = Permission::where('key', 'can_dispatch_order_dispatches')->first();
        if ($permission) {
            Role::where('name', 'GM')->get()->each(function (Role $role) use ($permission) {
                $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]);
            });
        }
    }

    public function down(): void
    {
        $permissionId = Permission::where('key', 'can_dispatch_order_dispatches')->value('id');
        if ($permissionId) {
            Role::where('name', 'GM')->get()->each(function (Role $role) use ($permissionId) {
                $role->permissions()->detach($permissionId);
            });
        }
    }
};
