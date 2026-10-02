<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Refunding an invoice overpayment back to a customer is squarely
     * accountant work - grant the permission the new refund-overpayment
     * endpoint checks (can_refund_payments) to the Accountant role created
     * in 2026_09_23_000001, wherever it already exists.
     */
    public function up(): void
    {
        $permission = Permission::where('key', 'can_refund_payments')->first();
        if (!$permission) {
            return;
        }

        Role::where('name', 'Accountant')->get()->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]);
        });
    }

    public function down(): void
    {
        // Not reversible - leaving the permission granted is harmless and
        // other roles may have started depending on it by then.
    }
};
