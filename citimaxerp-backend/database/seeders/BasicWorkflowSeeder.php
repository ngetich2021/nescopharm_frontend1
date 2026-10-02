<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\ApprovalWorkflow;
use App\Models\ApprovalWorkflowStep;
use App\Models\Company;
use App\Models\Role;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class BasicWorkflowSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        $this->command->info('Seeding basic approval workflows...');

        // Get all companies to create workflows for each
        $companies = Company::all();

        foreach ($companies as $company) {
            $this->createCustomerAccountWorkflow($company);
            $this->createCustomerWorkflow($company);
            $this->createDispatchWorkflow($company);
            $this->createOrderDispatchWorkflow($company);
        }

        $this->command->info('Basic workflows seeded successfully.');
    }

    /**
     * Create customer account approval workflow
     */
    private function createCustomerAccountWorkflow($company)
    {
        // Check if workflow already exists
        $existingWorkflow = ApprovalWorkflow::where('module_type', 'customer_account')
                                           ->where('company_id', $company->id)
                                           ->first();

        if ($existingWorkflow) {
            return;
        }

        // Get roles for approvers (fallback to any available roles if specific ones don't exist)
        $salesRole = Role::where('company_id', $company->id)
                        ->where('name', 'LIKE', '%sales%')
                        ->first();
        
        $financeRole = Role::where('company_id', $company->id)
                          ->where('name', 'LIKE', '%finance%')
                          ->first();

        $managerRole = Role::where('company_id', $company->id)
                          ->where('name', 'LIKE', '%manager%')
                          ->orWhere('name', 'LIKE', '%admin%')
                          ->first();

        // Use first available role as fallback
        $fallbackRole = Role::where('company_id', $company->id)->first();

        $workflow = ApprovalWorkflow::create([
            'id' => (string) Str::uuid(),
            'name' => 'Customer Account Approval',
            'module_type' => 'customer_account',
            'company_id' => $company->id,
            'description' => 'Standard approval workflow for customer account creation',
            'conditions' => [
                [
                    'field' => 'credit_required',
                    'operator' => '>',
                    'value' => 0
                ]
            ],
            'priority' => 10,
            'created_by' => null, // System created
        ]);

        // Step 1: Sales Review
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 1,
            'step_name' => 'Sales Review',
            'description' => 'Review customer account details and business information',
            'approver_type' => 'role',
            'approver_reference' => ($salesRole ?? $fallbackRole)->id,
            'conditions' => null,
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 24,
            'escalation_approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Step 2: Finance Review (only for high credit requirements)
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 2,
            'step_name' => 'Finance Review',
            'description' => 'Review financial details and credit limits',
            'approver_type' => 'role',
            'approver_reference' => ($financeRole ?? $fallbackRole)->id,
            'conditions' => json_encode([
                [
                    'field' => 'credit_required',
                    'operator' => '>=',
                    'value' => 50000
                ]
            ]),
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 48,
            'escalation_approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Step 3: Manager Final Approval (for very high credit)
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 3,
            'step_name' => 'Manager Final Approval',
            'description' => 'Final approval for high-value customer accounts',
            'approver_type' => 'role',
            'approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'conditions' => json_encode([
                [
                    'field' => 'credit_required',
                    'operator' => '>=',
                    'value' => 100000
                ]
            ]),
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 72,
            'escalation_approver_reference' => null,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info("  ✓ Created customer account workflow for {$company->name}");
    }

    /**
     * Create customer approval workflow
     */
    private function createCustomerWorkflow($company)
    {
        // Check if workflow already exists
        $existingWorkflow = ApprovalWorkflow::where('module_type', 'customer')
                                           ->where('company_id', $company->id)
                                           ->first();

        if ($existingWorkflow) {
            return;
        }

        $salesRole = Role::where('company_id', $company->id)
                        ->where('name', 'LIKE', '%sales%')
                        ->first();

        $fallbackRole = Role::where('company_id', $company->id)->first();

        $workflow = ApprovalWorkflow::create([
            'id' => (string) Str::uuid(),
            'name' => 'Customer Approval',
            'module_type' => 'customer',
            'company_id' => $company->id,
            'description' => 'Approval workflow for business customer creation',
            'conditions' => [
                [
                    'field' => 'customer_type',
                    'operator' => '=',
                    'value' => 'company'
                ]
            ],
            'priority' => 5,
            'created_by' => null,
        ]);

        // Step 1: Sales Team Review
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 1,
            'step_name' => 'Sales Team Review',
            'description' => 'Review customer information and business details',
            'approver_type' => 'role',
            'approver_reference' => ($salesRole ?? $fallbackRole)->id,
            'conditions' => null,
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 24,
            'escalation_approver_reference' => null,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info("  ✓ Created customer workflow for {$company->name}");
    }

    /**
     * Create dispatch approval workflow
     */
    private function createDispatchWorkflow($company)
    {
        // Check if workflow already exists
        $existingWorkflow = ApprovalWorkflow::where('module_type', 'dispatch')
                                           ->where('company_id', $company->id)
                                           ->first();

        if ($existingWorkflow) {
            return;
        }

        $warehouseRole = Role::where('company_id', $company->id)
                            ->where('name', 'LIKE', '%warehouse%')
                            ->orWhere('name', 'LIKE', '%inventory%')
                            ->first();

        $managerRole = Role::where('company_id', $company->id)
                          ->where('name', 'LIKE', '%manager%')
                          ->orWhere('name', 'LIKE', '%admin%')
                          ->first();

        $fallbackRole = Role::where('company_id', $company->id)->first();

        $workflow = ApprovalWorkflow::create([
            'id' => (string) Str::uuid(),
            'name' => 'Dispatch Approval',
            'module_type' => 'dispatch',
            'company_id' => $company->id,
            'description' => 'Approval workflow for dispatch requests',
            'conditions' => [
                [
                    'field' => 'to_entity',
                    'operator' => '=',
                    'value' => 'external'
                ]
            ],
            'priority' => 8,
            'created_by' => null,
        ]);

        // Step 1: Warehouse Manager Review
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 1,
            'step_name' => 'Warehouse Manager Review',
            'description' => 'Review dispatch items and destination',
            'approver_type' => 'role',
            'approver_reference' => ($warehouseRole ?? $fallbackRole)->id,
            'conditions' => null,
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 12,
            'escalation_approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Step 2: Operations Manager (for high-value dispatches)
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 2,
            'step_name' => 'Operations Manager Review',
            'description' => 'Final approval for high-value external dispatches',
            'approver_type' => 'role',
            'approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'conditions' => json_encode([
                [
                    'field' => 'type',
                    'operator' => '=',
                    'value' => 'high_value'
                ]
            ]),
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 24,
            'escalation_approver_reference' => null,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info("  ✓ Created dispatch workflow for {$company->name}");
    }

    /**
     * Create order dispatch approval workflow
     */
    private function createOrderDispatchWorkflow($company)
    {
        // Check if workflow already exists
        $existingWorkflow = ApprovalWorkflow::where('module_type', 'order_dispatch')
                                           ->where('company_id', $company->id)
                                           ->first();

        if ($existingWorkflow) {
            return;
        }

        $salesRole = Role::where('company_id', $company->id)
                        ->where('name', 'LIKE', '%sales%')
                        ->first();

        $warehouseRole = Role::where('company_id', $company->id)
                            ->where('name', 'LIKE', '%warehouse%')
                            ->orWhere('name', 'LIKE', '%inventory%')
                            ->first();

        $managerRole = Role::where('company_id', $company->id)
                          ->where('name', 'LIKE', '%manager%')
                          ->orWhere('name', 'LIKE', '%admin%')
                          ->first();

        $fallbackRole = Role::where('company_id', $company->id)->first();

        $workflow = ApprovalWorkflow::create([
            'id' => (string) Str::uuid(),
            'name' => 'Order Dispatch Approval',
            'module_type' => 'order_dispatch',
            'company_id' => $company->id,
            'description' => 'Approval workflow for order dispatch creation and delivery',
            'conditions' => null, // Apply to all order dispatches
            'priority' => 9,
            'created_by' => null,
        ]);

        // Step 1: Sales Verification
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 1,
            'step_name' => 'Sales Verification',
            'description' => 'Verify order details and customer information',
            'approver_type' => 'role',
            'approver_reference' => ($salesRole ?? $fallbackRole)->id,
            'conditions' => null,
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 12,
            'escalation_approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Step 2: Warehouse Approval
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 2,
            'step_name' => 'Warehouse Approval',
            'description' => 'Confirm product availability and packaging',
            'approver_type' => 'role',
            'approver_reference' => ($warehouseRole ?? $fallbackRole)->id,
            'conditions' => null,
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 24,
            'escalation_approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Step 3: Operations Manager Final Approval (for large orders)
        DB::table('approval_workflow_steps')->insert([
            'id' => (string) Str::uuid(),
            'workflow_id' => $workflow->id,
            'step_order' => 3,
            'step_name' => 'Operations Manager Approval',
            'description' => 'Final approval for dispatch and delivery scheduling',
            'approver_type' => 'role',
            'approver_reference' => ($managerRole ?? $fallbackRole)->id,
            'conditions' => json_encode([
                [
                    'field' => 'total_items',
                    'operator' => '>=',
                    'value' => 10
                ]
            ]),
            'is_required' => 't',
            'allow_rejection' => 't',
            'timeout_hours' => 24,
            'escalation_approver_reference' => null,
            'is_active' => 't',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info("  ✓ Created order dispatch workflow for {$company->name}");
    }
}