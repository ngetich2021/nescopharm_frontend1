<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Permission;
use Illuminate\Support\Str;

class SystemPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        $permissions = [
            // Dashboard & Overview
            [
                'name' => 'View Dashboard',
                'description' => 'View main dashboard and overview',
                'category' => 'Dashboard & Overview',
            ],
            [
                'name' => 'View Sales Overview',
                'description' => 'View sales analytics and overview',
                'category' => 'Dashboard & Overview',
            ],
            [
                'name' => 'View Inventory Overview',
                'description' => 'View inventory analytics and overview',
                'category' => 'Dashboard & Overview',
            ],
            [
                'name' => 'View Reports',
                'description' => 'Access reports section',
                'category' => 'Dashboard & Overview',
            ],

            // User Management
            [
                'name' => 'Manage All Users',
                'description' => 'Manage all users in company',
                'category' => 'User Management',
            ],
            [
                'name' => 'Manage Users and Roles',
                'description' => 'Manage users and their role assignments',
                'category' => 'User Management',
            ],
            [
                'name' => 'Access Admin Portal',
                'description' => 'Access administrative portal',
                'category' => 'User Management',
            ],
            [
                'name' => 'Manage Company Permissions',
                'description' => 'Create and manage company-specific permissions',
                'category' => 'User Management',
            ],
            [
                'name' => 'Manage System Permissions',
                'description' => 'Create and manage system-wide permissions',
                'category' => 'User Management',
            ],

            // Company Management
            [
                'name' => 'Manage Companies',
                'description' => 'Manage company settings and configuration',
                'category' => 'Company Management',
            ],
            [
                'name' => 'Manage Company Settings',
                'description' => 'Manage company configuration and preferences',
                'category' => 'Company Management',
            ],
            [
                'name' => 'Manage Subscriptions',
                'description' => 'Manage subscription plans and billing',
                'category' => 'Company Management',
            ],
            [
                'name' => 'Manage Subscriptions and Payments',
                'description' => 'Manage subscriptions and payment processing',
                'category' => 'Company Management',
            ],

            // Orders & Sales
            [
                'name' => 'View Orders',
                'description' => 'View order information',
                'category' => 'Orders & Sales',
            ],
            [
                'name' => 'Create Orders',
                'description' => 'Create new orders',
                'category' => 'Orders & Sales',
            ],
            [
                'name' => 'Edit Orders',
                'description' => 'Edit existing orders',
                'category' => 'Orders & Sales',
            ],
            [
                'name' => 'Delete Orders',
                'description' => 'Delete orders',
                'category' => 'Orders & Sales',
            ],

            // Quotes
            [
                'name' => 'View Quotes',
                'description' => 'View quote information',
                'category' => 'Quotes',
            ],
            [
                'name' => 'Create Quotes',
                'description' => 'Create new quotes',
                'category' => 'Quotes',
            ],
            [
                'name' => 'Edit Quotes',
                'description' => 'Edit existing quotes',
                'category' => 'Quotes',
            ],
            [
                'name' => 'Delete Quotes',
                'description' => 'Delete quotes',
                'category' => 'Quotes',
            ],

            // Products & Inventory
            [
                'name' => 'View Products',
                'description' => 'View product information',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'Create Products',
                'description' => 'Create new products',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'Edit Products',
                'description' => 'Edit existing products',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'Delete Products',
                'description' => 'Delete products',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'View Stock Counts',
                'description' => 'View inventory stock counts',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'Create Stock Counts',
                'description' => 'Create new stock counts',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'Edit Stock Counts',
                'description' => 'Edit existing stock counts',
                'category' => 'Products & Inventory',
            ],
            [
                'name' => 'Delete Stock Counts',
                'description' => 'Delete stock counts',
                'category' => 'Products & Inventory',
            ],

            // Customers
            [
                'name' => 'View Customers',
                'description' => 'View customer information',
                'category' => 'Customers',
            ],
            [
                'name' => 'Create Customers',
                'description' => 'Create new customers',
                'category' => 'Customers',
            ],
            [
                'name' => 'Edit Customers',
                'description' => 'Edit customer details',
                'category' => 'Customers',
            ],
            [
                'name' => 'Delete Customers',
                'description' => 'Delete customers',
                'category' => 'Customers',
            ],

            // Financial Management
            [
                'name' => 'View Payments',
                'description' => 'View payment information',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Manage Payments',
                'description' => 'Manage payment processing',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'View Invoices',
                'description' => 'View invoice information',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Create Invoices',
                'description' => 'Create new invoices',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Edit Invoices',
                'description' => 'Edit existing invoices',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Delete Invoices',
                'description' => 'Delete invoices',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'View Expenses',
                'description' => 'View expense information',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Create Expenses',
                'description' => 'Create new expenses',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Edit Expenses',
                'description' => 'Edit existing expenses',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Delete Expenses',
                'description' => 'Delete expenses',
                'category' => 'Financial Management',
            ],
            [
                'name' => 'Manage All Expenses',
                'description' => 'Manage all company expenses',
                'category' => 'Financial Management',
            ],

            // Operations
            [
                'name' => 'View Stores',
                'description' => 'View store information',
                'category' => 'Operations',
            ],
            [
                'name' => 'Manage Stores',
                'description' => 'Manage store operations',
                'category' => 'Operations',
            ],
            [
                'name' => 'View Logistics',
                'description' => 'View logistics information',
                'category' => 'Operations',
            ],
            [
                'name' => 'Manage Logistics',
                'description' => 'Manage logistics operations',
                'category' => 'Operations',
            ],
            [
                'name' => 'Manage All Delivery Persons',
                'description' => 'Manage delivery personnel',
                'category' => 'Operations',
            ],

            // Communication
            [
                'name' => 'View Chat',
                'description' => 'View chat conversations',
                'category' => 'Communication',
            ],
            [
                'name' => 'Manage Chat',
                'description' => 'Manage chat system and conversations',
                'category' => 'Communication',
            ],

            // System Settings
            [
                'name' => 'View Settings',
                'description' => 'View system settings',
                'category' => 'System Settings',
            ],
            [
                'name' => 'Manage Pricing',
                'description' => 'Manage pricing configuration',
                'category' => 'System Settings',
            ],
            [
                'name' => 'Manage Profile',
                'description' => 'Manage user profile',
                'category' => 'System Settings',
            ],
            [
                'name' => 'Manage Features and Permissions',
                'description' => 'Manage features and permission system',
                'category' => 'System Settings',
            ],
        ];

        foreach ($permissions as $permissionData) {
            $key = Permission::generateKey($permissionData['name']);
            
            // Skip if permission already exists
            // `key` is globally unique, so an existing key must not be
            // inserted again even if an older database marked it as a
            // company permission instead of a system permission.
            if (Permission::where('key', $key)->exists()) {
                continue;
            }

            Permission::create([
                'id' => (string) Str::uuid(),
                'name' => $permissionData['name'],
                'key' => $key,
                'description' => $permissionData['description'],
                'category' => $permissionData['category'],
                'company_id' => null, // System permission
                'is_system' => true,
                'is_active' => true,
                'created_by' => null,
                'metadata' => [],
            ]);
        }

        $this->command->info('System permissions seeded successfully!');
    }
}
