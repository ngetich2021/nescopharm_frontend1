<?php

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Adds a `can_adjust_closing_stock` permission and a "Director" role
     * (granted full company-level access, `can_manage_company`, plus that
     * permission explicitly) for every existing company - closing-stock
     * adjustments are restricted to this permission going forward.
     */
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'can_adjust_closing_stock'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Adjust Closing Stock',
                'description' => 'Set/declare closing stock quantities on a stock adjustment',
                'category' => 'Stock Adjustments',
                'is_active' => true,
            ]
        );

        $manageCompany = Permission::where('key', 'can_manage_company')->first();
        $viewReports = Permission::where('key', 'can_view_reports')->first();

        // `roles.name` is unique system-wide (not per company) in this
        // schema, so only one company can ever hold a given role name at a
        // time - skip inactive/merged company records and tolerate a name
        // collision on any one company without failing the whole batch.
        Company::query()->whereRaw('is_active = true')->each(function (Company $company) use ($permission, $manageCompany, $viewReports) {
            try {
                $role = Role::firstOrCreate(
                    ['name' => 'Director', 'company_id' => $company->id],
                    [
                        'id' => (string) Str::uuid(),
                        'description' => 'Company director - full oversight, including closing-stock adjustments',
                        'is_active' => true,
                    ]
                );

                foreach (array_filter([$manageCompany, $viewReports, $permission]) as $perm) {
                    $role->permissions()->syncWithoutDetaching([$perm->id => ['granted_at' => now()]]);
                }
            } catch (\Illuminate\Database\QueryException $e) {
                report($e);
            }
        });
    }

    public function down(): void
    {
        Role::where('name', 'Director')->delete();
        Permission::where('key', 'can_adjust_closing_stock')->delete();
    }
};
