<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * Accountants can delete customers directly (any customer, as the GM and admins can).
 */
return new class extends Migration
{
    public function up(): void
    {
        $id = Permission::where('key', 'can_delete_customers')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$id => ['granted_at' => now()]]));
        }
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_delete_customers')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
