<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Asset Register module permissions. Granted to GM, Director and Accountant
     * roles; can_manage_company / can_manage_system roles get access implicitly
     * through the controller's permission cascade.
     */
    private const PERMISSIONS = [
        ['key' => 'can_view_assets_menu', 'name' => 'View Assets Menu', 'description' => 'Access to the assets section in the main navigation menu', 'category' => 'Menu Permissions'],
        ['key' => 'can_view_assets', 'name' => 'View Assets', 'description' => 'View the company asset register', 'category' => 'Asset Management'],
        ['key' => 'can_create_assets', 'name' => 'Create Assets', 'description' => 'Add and import assets', 'category' => 'Asset Management'],
        ['key' => 'can_update_assets', 'name' => 'Update Assets', 'description' => 'Edit existing assets', 'category' => 'Asset Management'],
        ['key' => 'can_delete_assets', 'name' => 'Delete Assets', 'description' => 'Remove assets from the register', 'category' => 'Asset Management'],
        ['key' => 'can_manage_assets', 'name' => 'Manage Assets', 'description' => 'Full management of the asset register', 'category' => 'Asset Management'],
    ];

    private const GRANT_ROLES = ['GM', 'Director', 'Accountant'];

    public function up(): void
    {
        foreach (self::PERMISSIONS as $perm) {
            Permission::firstOrCreate(
                ['key' => $perm['key']],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $perm['name'],
                    'description' => $perm['description'],
                    'category' => $perm['category'],
                    'is_system' => true,
                    'is_active' => true,
                ]
            );
        }

        $keys = array_column(self::PERMISSIONS, 'key');
        $permissions = Permission::whereIn('key', $keys)->get();
        $syncData = $permissions->mapWithKeys(fn (Permission $perm) => [$perm->id => ['granted_at' => now()]])->toArray();

        Role::whereIn('name', self::GRANT_ROLES)->each(function (Role $role) use ($syncData) {
            $role->permissions()->syncWithoutDetaching($syncData);
        });
    }

    public function down(): void
    {
        $keys = array_column(self::PERMISSIONS, 'key');
        $permissionIds = Permission::whereIn('key', $keys)->pluck('id')->toArray();

        Role::whereIn('name', self::GRANT_ROLES)->each(function (Role $role) use ($permissionIds) {
            $role->permissions()->detach($permissionIds);
        });

        Permission::whereIn('key', $keys)->delete();
    }
};
