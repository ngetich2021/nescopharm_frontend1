<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The Accountant gets every expense and HR permission: expenses (incl. approve / delete / all
 * staff's), employees, payroll, leave, salary advances, daily reports and the HR menus.
 * Five of these were checked by the HR / expense screens but never created, so not even an
 * admin role could hand them out - they are created here first.
 */
return new class extends Migration
{
    private const MISSING = [
        'can_edit_expenses' => ['Edit Expenses', 'Edit expense records', 'Financial Management'],
        'can_request_leave' => ['Request Leave', 'Submit leave requests', 'HR Management'],
        'can_request_salary_advance' => ['Request Salary Advance', 'Submit salary advance requests', 'HR Management'],
        'can_view_leave_management_menu' => ['View Leave Management Menu', 'Access to leave management in navigation menu', 'Menu Permissions'],
        'can_view_salary_advance_menu' => ['View Salary Advance Menu', 'Access to salary advances in navigation menu', 'Menu Permissions'],
    ];

    private const GRANT = [
        // Expenses
        'can_view_expenses', 'can_create_expenses', 'can_update_expenses', 'can_edit_expenses', 'can_delete_expenses',
        'can_approve_expenses', 'can_delete_approved_expenses', 'can_manage_all_expenses', 'can_view_expenses_menu',
        // HR: employees, payroll, leave, salary advances, daily reports
        'can_view_employees', 'can_create_employees', 'can_update_employees', 'can_delete_employees', 'can_view_employees_menu',
        'can_view_payroll', 'can_create_payroll', 'can_update_payroll', 'can_delete_payroll', 'can_process_payroll',
        'can_approve_payroll', 'can_manage_payroll', 'can_approve_salary_changes', 'can_view_payroll_menu',
        'can_approve_leave', 'can_request_leave', 'can_view_leave_management_menu',
        'can_request_salary_advance', 'can_view_salary_advance_menu',
        'can_approve_daily_reports', 'can_view_hr_dashboard_menu', 'can_view_employee_portal_menu',
    ];

    public function up(): void
    {
        foreach (self::MISSING as $key => [$name, $description, $category]) {
            if (!Permission::where('key', $key)->exists()) {
                // Booleans written literally: they bind as integers here, which Postgres rejects.
                DB::insert(
                    'INSERT INTO permissions (id, name, key, description, category, is_system, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, false, true, NOW(), NOW())',
                    [(string) Str::uuid(), $name, $key, $description, $category]
                );
            }
        }

        $sync = Permission::whereIn('key', self::GRANT)->pluck('id')
            ->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->all();

        Role::where('name', 'Accountant')->each(function (Role $role) use ($sync) {
            $role->permissions()->syncWithoutDetaching($sync);
        });
    }

    public function down(): void
    {
        $ids = Permission::whereIn('key', self::GRANT)->pluck('id');
        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($ids));
    }
};
