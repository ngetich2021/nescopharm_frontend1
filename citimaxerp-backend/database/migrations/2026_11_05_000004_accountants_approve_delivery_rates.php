<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * Accountants approve or reject delivery rates, as the GM and Director do.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_approve_delivery_rates'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Approve Delivery Rates',
                'description' => 'Approve or reject delivery rates',
                'category' => 'Dispatch',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_approve_delivery_rates')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
