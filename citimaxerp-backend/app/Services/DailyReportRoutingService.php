<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\User;

class DailyReportRoutingService
{
    /** Only Directors approve daily work reports (see DailyWorkReportController::canActOnReport). */
    public const APPROVER_ROLE = 'Director';

    public static function isApproverRole(?string $role): bool
    {
        return $role !== null && strcasecmp(trim($role), self::APPROVER_ROLE) === 0;
    }

    /**
     * Role-based routing for daily work reports (unlike leave/salary, which
     * use a fixed per-employee approver FK): every report, the GM's included,
     * goes to the Directors. A Director has nobody above them, so their own
     * report is self-certified/auto-approved rather than left pending forever.
     *
     * $employeeUser is the User account linked to the reporting employee -
     * it's their role, not the employee record itself, that decides where
     * the report is routed. Falls back to whoever holds the
     * can_manage_company/can_manage_system bypass if no user holds the
     * Director role, same fallback the leave/salary approver defaults use.
     */
    public static function resolveApprover(Employee $employee, User $employeeUser): array
    {
        $role = optional($employeeUser->role)->name;

        if (self::isApproverRole($role)) {
            return ['role' => null, 'user_id' => null, 'auto_approve' => true];
        }

        $requiredRole = self::APPROVER_ROLE;

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
