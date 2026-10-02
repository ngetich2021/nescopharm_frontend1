<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Permission;
use Illuminate\Support\Str;

class WorkflowPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        $workflowPermissions = [
            // Workflow Management
            [
                'name' => 'View Workflows',
                'key' => 'can_view_workflows',
                'description' => 'View approval workflows',
                'category' => 'Workflow Management',
            ],
            [
                'name' => 'Create Workflows',
                'key' => 'can_create_workflows',
                'description' => 'Create new approval workflows',
                'category' => 'Workflow Management',
            ],
            [
                'name' => 'Edit Workflows',
                'key' => 'can_edit_workflows',
                'description' => 'Edit existing approval workflows',
                'category' => 'Workflow Management',
            ],
            [
                'name' => 'Delete Workflows',
                'key' => 'can_delete_workflows',
                'description' => 'Delete approval workflows',
                'category' => 'Workflow Management',
            ],

            // Approval Actions
            [
                'name' => 'View Approvals',
                'key' => 'can_view_approvals',
                'description' => 'View approval requests and workflow instances',
                'category' => 'Approvals',
            ],
            [
                'name' => 'Approve Customer Accounts',
                'key' => 'can_approve_customer_accounts',
                'description' => 'Approve customer account creation requests',
                'category' => 'Approvals',
            ],
            [
                'name' => 'Approve Customers',
                'key' => 'can_approve_customers',
                'description' => 'Approve customer creation requests',
                'category' => 'Approvals',
            ],
            [
                'name' => 'Approve Dispatches',
                'key' => 'can_approve_dispatches',
                'description' => 'Approve dispatch requests',
                'category' => 'Approvals',
            ],
            [
                'name' => 'Approve Order Dispatches',
                'key' => 'can_approve_order_dispatches',
                'description' => 'Approve order dispatch requests',
                'category' => 'Approvals',
            ],
            [
                'name' => 'Cancel Workflows',
                'key' => 'can_cancel_workflows',
                'description' => 'Cancel active workflow instances',
                'category' => 'Approvals',
            ],

            // Order Dispatch Permissions
            [
                'name' => 'View Order Dispatches',
                'key' => 'can_view_order_dispatches',
                'description' => 'View order dispatch records',
                'category' => 'Order Dispatches',
            ],
            [
                'name' => 'Create Order Dispatches',
                'key' => 'can_create_order_dispatches',
                'description' => 'Create new order dispatches from orders',
                'category' => 'Order Dispatches',
            ],
            [
                'name' => 'Update Order Dispatches',
                'key' => 'can_update_order_dispatches',
                'description' => 'Update order dispatch details',
                'category' => 'Order Dispatches',
            ],
            [
                'name' => 'Delete Order Dispatches',
                'key' => 'can_delete_order_dispatches',
                'description' => 'Delete order dispatches',
                'category' => 'Order Dispatches',
            ],
            [
                'name' => 'Dispatch Orders',
                'key' => 'can_dispatch_orders',
                'description' => 'Create logistics and dispatch approved orders',
                'category' => 'Order Dispatches',
            ],

            // Workflow Reports
            [
                'name' => 'View Workflow Reports',
                'key' => 'can_view_workflow_reports',
                'description' => 'View workflow statistics and reports',
                'category' => 'Workflow Reports',
            ],
            [
                'name' => 'View All Company Approvals',
                'key' => 'can_view_all_company_approvals',
                'description' => 'View all approval workflows for the company',
                'category' => 'Workflow Reports',
            ],

            // Advanced Workflow Features
            [
                'name' => 'Escalate Approvals',
                'key' => 'can_escalate_approvals',
                'description' => 'Escalate approval requests to higher authority',
                'category' => 'Advanced Workflow',
            ],
            [
                'name' => 'Delegate Approvals',
                'key' => 'can_delegate_approvals',
                'description' => 'Delegate approval authority to other users',
                'category' => 'Advanced Workflow',
            ],
            [
                'name' => 'Override Workflow',
                'key' => 'can_override_workflow',
                'description' => 'Override workflow requirements in emergency situations',
                'category' => 'Advanced Workflow',
            ],
        ];

        foreach ($workflowPermissions as $permissionData) {
            // Check if permission already exists
            $existingPermission = Permission::where('key', $permissionData['key'])
                                           ->whereRaw('is_system = true')
                                           ->first();
            
            if (!$existingPermission) {
                Permission::create([
                    'id' => (string) Str::uuid(),
                    'key' => $permissionData['key'],
                    'name' => $permissionData['name'],
                    'description' => $permissionData['description'],
                    'category' => $permissionData['category'],
                    'company_id' => null, // System permission
                    'is_system' => true,
                    'is_active' => true,
                    'created_by' => null,
                    'metadata' => [],
                ]);
            }
        }

        $this->command->info('Workflow permissions seeded successfully.');
    }
}