<?php

use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Re-run the approver fix from 2026_09_23_000013, now that GM/Director
     * hold can_approve_leave/can_approve_salary_changes directly (see
     * 2026_09_23_000014) - re-point any employee currently defaulted to a
     * generic admin account (via the can_manage_company bypass) at the
     * actual GM/Director instead, wherever one now exists for that company.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('employees', 'leave_approver_id') || !Schema::hasColumn('employees', 'salary_advance_approver_id')) {
            return;
        }

        $resolveDirect = function (string $companyId, ?string $excludeUserId, string $permissionKey): ?string {
            return User::where('company_id', $companyId)
                ->when($excludeUserId, fn ($q) => $q->where('id', '!=', $excludeUserId))
                ->whereRaw('is_active = true')
                ->whereHas('role.permissions', fn ($q) => $q->where('key', $permissionKey))
                ->orderBy('created_at')
                ->value('id');
        };

        $hasDirectPermission = function (?string $userId, string $permissionKey) {
            if (!$userId) {
                return false;
            }
            return User::where('id', $userId)
                ->whereHas('role.permissions', fn ($q) => $q->where('key', $permissionKey))
                ->exists();
        };

        Employee::query()->chunkById(200, function ($employees) use ($resolveDirect, $hasDirectPermission) {
            foreach ($employees as $employee) {
                $updates = [];

                if (!$hasDirectPermission($employee->leave_approver_id, 'can_approve_leave')) {
                    $direct = $resolveDirect($employee->company_id, $employee->id, 'can_approve_leave');
                    if ($direct) {
                        $updates['leave_approver_id'] = $direct;
                    }
                }

                if (!$hasDirectPermission($employee->salary_advance_approver_id, 'can_approve_salary_changes')) {
                    $direct = $resolveDirect($employee->company_id, $employee->id, 'can_approve_salary_changes');
                    if ($direct) {
                        $updates['salary_advance_approver_id'] = $direct;
                    }
                }

                if (!empty($updates)) {
                    $employee->update($updates);
                }
            }
        });
    }

    public function down(): void
    {
        // Not reversible - a step toward more correct data.
    }
};
