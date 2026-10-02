<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

class WarehouseManagerDispatchPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Define dispatch permissions that warehouse manager should have
        $dispatchPermissions = [
            'can_view_dispatch_menu',  // For accessing the dispatch page
            'can_view_order_dispatches',
            'can_create_order_dispatches',
            'can_update_order_dispatches',
            'can_delete_order_dispatches',
            'can_approve_order_dispatches',
            'can_dispatch_order_dispatches',
        ];

        // Get all companies
        $companies = \App\Models\Company::all();

        foreach ($companies as $company) {
            // Find Warehouse Manager role for this company
            $warehouseManagerRole = Role::where('company_id', $company->id)
                ->whereRaw("LOWER(name) LIKE LOWER('%warehouse manager%')")
                ->first();

            if (!$warehouseManagerRole) {
                $this->command->warn("Warehouse Manager role not found for company: {$company->name}");
                continue;
            }

            // Assign each dispatch permission to the warehouse manager role
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
                if (!$warehouseManagerRole->permissions()->where('permission_id', $permission->id)->exists()) {
                    $warehouseManagerRole->permissions()->attach($permission->id, [
                        'granted_at' => now(),
                    ]);
                    $this->command->info("Assigned {$permissionKey} to Warehouse Manager for {$company->name}");
                } else {
                    $this->command->info("{$permissionKey} already assigned to Warehouse Manager for {$company->name}");
                }
            }
        }

        $this->command->info('Warehouse Manager dispatch permissions seeding completed.');
    }
}
