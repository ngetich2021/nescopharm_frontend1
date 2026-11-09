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

    public static function isDirector(?User $user): bool
    {
        return $user !== null && self::isApproverRole(optional($user->role)->name);
    }

    /** The General Manager sees every employee's portal activity (but approves only what their permissions allow). */
    public static function isGm(?User $user): bool
    {
        $role = optional($user?->role)->name;
        return $role !== null && strcasecmp(trim($role), 'GM') === 0;
    }

    /**
     * Leave and salary advances go to any Director, like daily reports: any Director in the
     * company may decide an employee's request, except their own (another Director does that).
     */
    public static function directorCanDecide(?User $user, ?Employee $employee): bool
    {
        return self::isDirector($user)
            && $employee !== null
            && $employee->company_id === $user->company_id
            && $employee->user_id !== $user->id;
    }

    /** Active Directors' user ids, for notifying them of new requests. */
    public static function directorIds(string $companyId): array
    {
        return User::where('company_id', $companyId)
            ->whereRaw('is_active = true')
            ->whereHas('role', fn ($q) => $q->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(self::APPROVER_ROLE)]))
            ->pluck('id')
            ->all();
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
