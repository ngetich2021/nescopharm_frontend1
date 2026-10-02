<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;
use App\Models\Company;

class DeliveryManagementPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $companies = Company::all();

        // permission_key => [role name patterns that should get it]
        $roleAssignments = [
            'can_view_delivery_rates' => ['warehouse manager', 'gm', 'general manager', 'managing director', 'director', 'accountant'],
            'can_create_delivery_rates' => ['warehouse manager'],
            'can_approve_delivery_rates' => ['gm', 'general manager', 'managing director', 'director'],
            'can_view_delivery_invoices' => ['warehouse manager', 'accountant', 'gm', 'general manager', 'managing director', 'director'],
            'can_pay_delivery_invoices' => ['accountant'],
        ];

        foreach ($companies as $company) {
            foreach ($roleAssignments as $permissionKey => $roleNamePatterns) {
                $permission = Permission::firstOrCreate(
                    ['key' => $permissionKey],
                    [
                        'name' => str_replace('_', ' ', ucfirst($permissionKey)),
                        'description' => "Permission to {$permissionKey}",
                        'category' => 'Delivery Management',
                        'is_system' => true,
                        'is_active' => true,
                    ]
                );

                foreach ($roleNamePatterns as $pattern) {
                    $roles = Role::where('company_id', $company->id)
                        ->whereRaw("LOWER(name) LIKE LOWER(?)", ["%{$pattern}%"])
                        ->get();

                    foreach ($roles as $role) {
                        if (!$role->permissions()->where('permission_id', $permission->id)->exists()) {
                            $role->permissions()->attach($permission->id, ['granted_at' => now()]);
                            $this->command->info("Assigned {$permissionKey} to {$role->name} ({$company->name})");
                        }
                    }
                }
            }
        }

        $this->command->info('Delivery management permissions seeding completed.');
    }
}
