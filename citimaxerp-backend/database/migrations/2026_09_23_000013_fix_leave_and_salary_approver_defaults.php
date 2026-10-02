<?php

use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * EmployeeSelfServiceController::resolveDefaultApproverId() used to just
     * pick the oldest active user account in the company as both the leave
     * and salary advance approver - regardless of whether that person held
     * any approval permission at all. Every auto-provisioned employee ended
     * up pointed at whoever happened to sign the company up first. Re-point
     * any employee currently assigned to a non-approver at a real one.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('employees', 'leave_approver_id') || !Schema::hasColumn('employees', 'salary_advance_approver_id')) {
            return;
        }

        $resolveApprover = function (string $companyId, ?string $excludeUserId, string $permissionKey): ?string {
            return User::where('company_id', $companyId)
                ->when($excludeUserId, fn ($q) => $q->where('id', '!=', $excludeUserId))
                ->whereRaw('is_active = true')
                ->whereHas('role.permissions', function ($q) use ($permissionKey) {
                    $q->whereIn('key', [$permissionKey, 'can_manage_company', 'can_manage_system']);
                })
                ->orderBy('created_at')
                ->value('id');
        };

        $isValidApprover = function (?string $userId, string $permissionKey) {
            if (!$userId) {
                return false;
            }
            return User::where('id', $userId)
                ->whereHas('role.permissions', function ($q) use ($permissionKey) {
                    $q->whereIn('key', [$permissionKey, 'can_manage_company', 'can_manage_system']);
                })
                ->exists();
        };

        Employee::query()->chunkById(200, function ($employees) use ($resolveApprover, $isValidApprover) {
            foreach ($employees as $employee) {
                $updates = [];

                if (!$isValidApprover($employee->leave_approver_id, 'can_approve_leave')) {
                    $updates['leave_approver_id'] = $resolveApprover($employee->company_id, $employee->id, 'can_approve_leave');
                }

                if (!$isValidApprover($employee->salary_advance_approver_id, 'can_approve_salary_changes')) {
                    $updates['salary_advance_approver_id'] = $resolveApprover($employee->company_id, $employee->id, 'can_approve_salary_changes');
                }

                if (!empty($updates)) {
                    $employee->update($updates);
                }
            }
        });
    }

    public function down(): void
    {
        // Not reversible - the pre-fix assignments were themselves wrong.
    }
};
