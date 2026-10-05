<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Purchase order approval belongs to the GM and Director roles only. The approve endpoint checks
     * this permission directly, without the usual can_manage_company/can_manage_system bypass.
     */
    private const APPROVER_ROLES = ['GM', 'Director'];

    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_approve_purchase_orders'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Approve Purchase Orders',
                'description' => 'Approve purchase orders (GM and Director only)',
                'category' => 'Purchase Orders',
                'is_active' => true,
            ]
        );

        DB::table('role_permissions')
            ->where('permission_id', $permission->id)
            ->whereNotIn('role_id', Role::whereIn('name', self::APPROVER_ROLES)->pluck('id'))
            ->delete();

        Role::whereIn('name', self::APPROVER_ROLES)->get()->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([$permission->id => ['granted_at' => now()]]);
        });
    }

    public function down(): void
    {
        $permission = Permission::where('key', 'can_approve_purchase_orders')->first();
        if ($permission) {
            DB::table('role_permissions')->where('permission_id', $permission->id)->delete();
            $permission->delete();
        }
    }
};
