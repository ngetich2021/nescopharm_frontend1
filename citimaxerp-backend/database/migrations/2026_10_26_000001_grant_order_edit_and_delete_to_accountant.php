<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * The Accountant corrects and clears orders, past (pre-go-live) sales included: editing and
 * deleting them. Delete was never granted; edit is re-granted in case the role lost it.
 * Deleting still refuses an order whose invoice has credit notes (OrderDeletionService).
 */
return new class extends Migration
{
    private const GRANT = ['can_update_orders', 'can_delete_orders'];

    public function up(): void
    {
        $sync = Permission::whereIn('key', self::GRANT)->pluck('id')
            ->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->all();

        Role::where('name', 'Accountant')->each(function (Role $role) use ($sync) {
            $role->permissions()->syncWithoutDetaching($sync);
        });
    }

    public function down(): void
    {
        // can_update_orders came with the role itself, so only delete is taken back.
        $id = Permission::where('key', 'can_delete_orders')->value('id');
        if ($id) {
            Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
