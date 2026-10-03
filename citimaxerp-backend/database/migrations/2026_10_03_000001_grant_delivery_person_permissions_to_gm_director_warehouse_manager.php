<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    private const PERMISSION_KEYS = [
        'can_create_delivery_persons',
        'can_update_delivery_persons',
        'can_manage_delivery_persons',
    ];
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
