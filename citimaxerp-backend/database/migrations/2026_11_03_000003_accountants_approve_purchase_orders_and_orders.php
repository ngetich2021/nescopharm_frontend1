<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Accountants approve purchase orders (and orders for invoicing, by role in Order) as well as the
 * GM and Director - but never one they raised themselves: Accountant A raises, Accountant B
 * approves. Orders now record who raised them so that check (and the alert) can tell.
 */
return new class extends Migration {
    public function up(): void
    {
        $permission = Permission::where('key', 'can_approve_purchase_orders')->first();
        if ($permission) {
            $permission->update(['description' => 'Approve purchase orders (GM, Director and Accountant; an accountant cannot approve one they raised)']);
            Role::whereRaw("LOWER(TRIM(name)) = 'accountant'")->get()->each(function (Role $role) use ($permission) {
                $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]);
            });
        }

        if (!Schema::hasColumn('orders', 'created_by')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->uuid('created_by')->nullable();
            });
        }
    }

    public function down(): void
    {
        $permission = Permission::where('key', 'can_approve_purchase_orders')->first();
        if ($permission) {
            $permission->roles()->detach(Role::whereRaw("LOWER(TRIM(name)) = 'accountant'")->pluck('id'));
        }
        if (Schema::hasColumn('orders', 'created_by')) {
            Schema::table('orders', fn (Blueprint $table) => $table->dropColumn('created_by'));
        }
    }
};
