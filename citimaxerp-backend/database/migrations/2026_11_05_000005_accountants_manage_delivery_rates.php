<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * Accountants add, edit and delete delivery rates, as the Warehouse Manager does.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_create_delivery_rates'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Create Delivery Rates',
                'description' => 'Add, edit and delete delivery rates',
                'category' => 'Dispatch',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_create_delivery_rates')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
