<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\User;

class DailyReportRoutingService
{
    /**
     * Role-based routing for daily work reports (unlike leave/salary, which
     * use a fixed per-employee approver FK): a worker's report goes to GM,
     * a GM's own report goes to the Managing Director ("Director" role).
     * Director has nobody above them in this chain, so their own report is
     * self-certified/auto-approved rather than left pending forever.
     *
     * $employeeUser is the User account linked to the reporting employee -
     * it's their role, not the employee record itself, that decides where
     * the report is routed. Falls back to whoever holds the
     * can_manage_company/can_manage_system bypass if no user literally
     * holds the GM/Director role, same fallback the leave/salary approver
     * defaults use.
     *
     * Used both synchronously (EmployeeSelfServiceController, when the
     * employee submits) and from the nightly FlagMissingDailyReports
     * command (when the system auto-posts on a silent employee's behalf).
     */
    public static function resolveApprover(Employee $employee, User $employeeUser): array
    {
        $role = optional($employeeUser->role)->name;

        if ($role && strcasecmp($role, 'Director') === 0) {
            return ['role' => null, 'user_id' => null, 'auto_approve' => true];
        }

        $requiredRole = ($role && strcasecmp($role, 'GM') === 0) ? 'Director' : 'GM';

        $approverId = User::where('company_id', $employee->company_id)
            ->where('id', '!=', $employeeUser->id)
            ->whereRaw('is_active = true')
            ->whereHas('role', fn ($q) => $q->where('name', $requiredRole))
            ->orderBy('created_at')
            ->value('id');

        if (!$approverId) {
            $approverId = User::where('company_id', $employee->company_id)
                ->where('id', '!=', $employeeUser->id)
                ->whereRaw('is_active = true')
                ->whereHas('role.permissions', fn ($q) => $q->whereIn('key', ['can_manage_company', 'can_manage_system']))
                ->orderBy('created_at')
                ->value('id');
        }

        return ['role' => $requiredRole, 'user_id' => $approverId, 'auto_approve' => false];
    }
}
