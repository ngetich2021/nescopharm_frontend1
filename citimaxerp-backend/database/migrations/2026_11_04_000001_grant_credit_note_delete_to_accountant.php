<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * Accountants can delete credit notes. Its own permission: can_delete_invoices would also let
 * them delete invoices and receipts.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_delete_credit_notes'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Delete Credit Notes',
                'description' => 'Delete credit notes; the credit and returned stock are undone',
                'category' => 'Invoicing',
                'is_system' => true,
                'is_active' => true,
            ]
        );

        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_delete_credit_notes')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($id));
            Permission::whereKey($id)->delete();
        }
    }
};
