<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * "Edit Debit Notes": edit a debit note for goods returned to a supplier (SDEB/0001). GM, Director and
 * Accountant start with it; any role can be given it on Users > Roles.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_edit_debit_notes'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Edit Debit Notes',
                'description' => 'Edit debit notes for goods returned to suppliers: date, reason, supplier credit note no. and quantities',
                'category' => 'Suppliers',
                'is_system' => true,
                'is_active' => true,
            ]
        );
        Role::whereIn('name', ['GM', 'Director', 'Accountant'])
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_edit_debit_notes')->value('id');
        if ($id) {
            Role::all()->each(fn (Role $role) => $role->permissions()->detach($id));
            Permission::whereKey($id)->delete();
        }
    }
};
