<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * The Accountant role manages customer credit accounts (certificate of
     * incorporation, director IDs, KYC docs) but was never granted document
     * permissions, so EditCustomerModal's document tab silently fails with
     * "Unauthorized to view documents." for this role.
     */
    private const PERMISSION_KEYS = [
        'can_view_documents', 'can_create_documents', 'can_update_documents',
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
