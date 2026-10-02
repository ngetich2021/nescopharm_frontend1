<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Same class of bug as can_manage_accounting_settings/can_generate_financial_reports:
     * PayrollController::update()/destroy() (and now PayrollRunController::updatePayslip())
     * check can_update_payroll/can_delete_payroll, but neither was ever actually seeded -
     * so nobody except a can_manage_system/can_manage_company admin could ever reach them.
     */
    public function up(): void
    {
        Permission::firstOrCreate(
            ['key' => 'can_update_payroll'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Update Payroll',
                'description' => 'Edit payroll records and payslips',
                'category' => 'HR Management',
                'is_active' => true,
            ]
        );

        Permission::firstOrCreate(
            ['key' => 'can_delete_payroll'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Delete Payroll',
                'description' => 'Delete payroll records',
                'category' => 'HR Management',
                'is_active' => true,
            ]
        );
    }

    public function down(): void
    {
        // Leave in place - deleting would break the controllers checking for them again.
    }
};
