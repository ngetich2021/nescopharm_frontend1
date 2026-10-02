<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Two corrections to the Accountant role from 2026_09_23_000001:
     * - It's missing can_view_reports/can_view_reports_menu, so the topbar
     *   Reports dropdown and the report pages themselves weren't reachable.
     * - It was granted Expenses access it shouldn't have - revoke it.
     */
    private const GRANT_KEYS = [
        'can_view_reports',
        'can_view_reports_menu',
        'can_manage_payments',
    ];

    private const REVOKE_KEYS = [
        'can_view_expenses',
        'can_create_expenses',
        'can_update_expenses',
        'can_view_expenses_menu',
    ];

    public function up(): void
    {
        $grantIds = Permission::whereIn('key', self::GRANT_KEYS)->pluck('id');
        $revokeIds = Permission::whereIn('key', self::REVOKE_KEYS)->pluck('id');

        Role::where('name', 'Accountant')->get()->each(function (Role $role) use ($grantIds, $revokeIds) {
            $syncData = $grantIds->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->toArray();
            $role->permissions()->syncWithoutDetaching($syncData);
            $role->permissions()->detach($revokeIds);
        });
    }

    public function down(): void
    {
        // Not reversible - the pre-fix state (missing reports, extra expenses
        // access) was itself what needed correcting.
    }
};
