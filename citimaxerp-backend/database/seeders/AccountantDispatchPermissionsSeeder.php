<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

class AccountantDispatchPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Define dispatch creation permissions for accountants
        $dispatchPermissions = [
            'can_create_order_dispatches',  // Allow creating dispatches from orders
            'can_view_order_dispatches',    // Allow viewing dispatch records
            'can_dispatch_order_dispatches', // Allow submitting dispatches for approval
        ];

        // Get all companies
        $companies = \App\Models\Company::all();

        foreach ($companies as $company) {
            // Find Accountant role (or similar accounting roles)
            $accountantRole = Role::where('company_id', $company->id)
                ->whereRaw("LOWER(name) LIKE LOWER('%accountant%') OR LOWER(name) LIKE LOWER('%accounting%')")
                ->first();

            if (!$accountantRole) {
                $this->command->warn("Accountant role not found for company: {$company->name}");
                continue;
            }

            // Assign each dispatch permission to the accountant role
            foreach ($dispatchPermissions as $permissionKey) {
                // Find or create the permission (as system permission)
                $permission = Permission::where('key', $permissionKey)->first();

                if (!$permission) {
                    // Create permission if it doesn't exist
                    $permission = Permission::create([
                        'name' => str_replace('_', ' ', ucfirst($permissionKey)),
                        'key' => $permissionKey,
                        'description' => "Permission to {$permissionKey}",
                        'category' => 'Dispatch',
                        'is_system' => true,
                        'is_active' => true,
                    ]);
                }

                // Assign permission to role if not already assigned
                if (!$accountantRole->permissions()->where('permission_id', $permission->id)->exists()) {
                    $accountantRole->permissions()->attach($permission->id, [
                        'granted_at' => now(),
                    ]);
                    $this->command->info("Assigned {$permissionKey} to Accountant for {$company->name}");
                } else {
                    $this->command->info("{$permissionKey} already assigned to Accountant for {$company->name}");
                }
            }
        }

        $this->command->info('Accountant dispatch permissions seeding completed.');
    }
}
