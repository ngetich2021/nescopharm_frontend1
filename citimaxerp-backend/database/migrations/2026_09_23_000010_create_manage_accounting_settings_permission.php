<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * The frontend has referenced "can_manage_accounting_settings" for
     * Accounting Settings and Account Mapping (app/finance/accounting-settings,
     * app/finance/account-mappings) since those pages were built, but it was
     * never actually added to the permissions table - so nobody except a
     * can_manage_system/can_manage_company admin could ever reach them.
     * Create the permission for real and grant it to the Accountant role.
     */
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_manage_accounting_settings'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Manage Accounting Settings',
                'description' => 'Configure accounting settings and map transaction types to accounts',
                'category' => 'Financial Management',
                'is_active' => true,
            ]
        );

        Role::where('name', 'Accountant')->get()->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]);
        });
    }

    public function down(): void
    {
        // Leave the permission itself in place - deleting it would break the
        // frontend pages that check for it again. Only reversible cleanup
        // would be un-granting it from the Accountant role, which isn't worth
        // doing separately from the permission's own removal.
    }
};
