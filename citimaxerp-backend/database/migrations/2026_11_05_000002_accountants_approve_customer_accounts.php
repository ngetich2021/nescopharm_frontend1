<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * Accountants approve or reject customer accounts on CRM > Accounts, and see the approvals made.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'can_approve_account' => ['Approve Account', 'Approve or reject customer account requests'],
        'can_view_account_approvals' => ['View Account Approvals', 'View the approvals made on customer accounts'],
    ];

    public function up(): void
    {
        foreach (self::PERMISSIONS as $key => [$name, $description]) {
            $permission = Permission::firstOrCreate(
                ['key' => $key],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $name,
                    'description' => $description,
                    'category' => 'Customer Management',
                    'is_system' => true,
                    'is_active' => true,
                ]
            );

            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]));
        }
    }

    public function down(): void
    {
        $ids = Permission::whereIn('key', array_keys(self::PERMISSIONS))->pluck('id');
        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($ids));
    }
};
