<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * GM/Director could already approve leave/salary via the can_manage_company
     * blanket bypass, but that bypass is shared with generic company-admin
     * accounts (super_admin, citimax_admin) too - so the "default approver"
     * lookup couldn't tell a real GM/Director apart from whoever happened to
     * sign the company up. Granting these directly lets that lookup (and any
     * future one) prefer an actual GM/Director over a generic admin account.
     */
    public function up(): void
    {
        $keys = ['can_approve_leave', 'can_approve_salary_changes'];
        $permissionIds = Permission::whereIn('key', $keys)->pluck('id');

        Role::whereIn('name', ['GM', 'Director'])->get()->each(function (Role $role) use ($permissionIds) {
            $syncData = $permissionIds->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->toArray();
            $role->permissions()->syncWithoutDetaching($syncData);
        });
    }

    public function down(): void
    {
        // Leave in place - not worth reversing a permission grant that's
        // strictly additive and matches the roles' intended authority.
    }
};
