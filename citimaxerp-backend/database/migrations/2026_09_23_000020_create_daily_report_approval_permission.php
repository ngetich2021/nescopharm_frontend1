<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Mirrors 2026_09_23_000011 (leave/salary approval permissions) and
     * 2026_09_23_000014 (granting them to GM/Director) for daily work
     * reports: workers' reports route to GM, and GM's own reports route to
     * the Managing Director ("Director"). GM/Director also already have a
     * blanket bypass via can_manage_company, but granting this directly
     * lets DailyWorkReportController tell a real GM/Director apart from a
     * generic company-admin account, same as the leave/salary case.
     */
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_approve_daily_reports'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Approve Daily Work Reports',
                'description' => 'Approve or reject employee daily work reports',
                'category' => 'HR Management',
                'is_active' => true,
            ]
        );

        Role::whereIn('name', ['GM', 'Director'])->get()->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([
                $permission->id => ['granted_at' => now()],
            ]);
        });
    }

    public function down(): void
    {
        Permission::where('key', 'can_approve_daily_reports')->delete();
    }
};
