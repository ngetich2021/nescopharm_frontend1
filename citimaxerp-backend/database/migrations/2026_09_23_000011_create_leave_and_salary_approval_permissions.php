<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Leave and salary approval were previously de-facto open to anyone with
     * general menu/edit access (LeaveController::update() only checked
     * can_view_leave_management_menu; EmployeeController::update() only
     * checked can_update_employees for the whole record, salary included).
     * These two new permissions let that be locked down specifically.
     * GM/Director already qualify via can_manage_company (which every
     * relevant controller's hasPermission() helper treats as a blanket
     * bypass) - these are for finer-grained grants if a company ever wants
     * to hand approval to someone without full company management rights.
     */
    public function up(): void
    {
        Permission::firstOrCreate(
            ['key' => 'can_approve_leave'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Approve Leave Requests',
                'description' => 'Approve or reject employee leave requests',
                'category' => 'HR Management',
                'is_active' => true,
            ]
        );

        Permission::firstOrCreate(
            ['key' => 'can_approve_salary_changes'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Approve Salary Changes',
                'description' => 'Change an employee\'s salary, hourly rate, allowances or deductions',
                'category' => 'HR Management',
                'is_active' => true,
            ]
        );
    }

    public function down(): void
    {
        Permission::whereIn('key', ['can_approve_leave', 'can_approve_salary_changes'])->delete();
    }
};
