<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * Accountants can be chosen as dispatch approvers alongside Directors, the GM and the Warehouse
 * Manager. Approving still needs them to be the dispatch's current approver, so this only lets
 * an accountant approve dispatches they were picked for.
 */
return new class extends Migration
{
    public function up(): void
    {
        $id = Permission::where('key', 'can_approve_order_dispatches')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$id => ['granted_at' => now()]]));
        }
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_approve_order_dispatches')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
