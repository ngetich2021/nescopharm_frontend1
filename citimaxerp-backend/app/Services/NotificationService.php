<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\SystemAlert;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Active users in the company whose role grants any of $permissions. Company admins
     * (can_manage_company) are included because every controller lets them approve anything.
     */
    public function usersWithPermission(string $companyId, array $permissions, bool $includeCompanyAdmins = true): Collection
    {
        $keys = array_values(array_unique($includeCompanyAdmins ? array_merge($permissions, ['can_manage_company']) : $permissions));

        return User::where('company_id', $companyId)
            ->whereRaw('users.is_active = true')
            ->whereHas('role', fn ($r) => $r->whereHas('permissions', fn ($p) => $p
                ->whereIn('permissions.key', $keys)
                ->whereRaw('permissions.is_active = true')))
            ->get();
    }

    /**
     * Notify permission holders plus any explicitly named users, never the person who triggered it.
     * Returns how many users were notified. Failures are logged, never thrown, so a notification
     * problem can't break the business action that triggered it.
     */
    public function notifyPermission(
        string $companyId,
        array $permissions,
        SystemAlert $alert,
        ?string $exceptUserId = null,
        array $alsoUserIds = [],
        bool $includeCompanyAdmins = true,
    ): int {
        try {
            $users = $this->usersWithPermission($companyId, $permissions, $includeCompanyAdmins);

            $extra = array_filter($alsoUserIds);
            if ($extra) {
                $users = $users->concat(User::whereIn('id', $extra)->get());
            }

            $users = $users->unique('id')->reject(fn ($u) => $exceptUserId && $u->id === $exceptUserId);

            foreach ($users as $user) {
                $user->notify(clone $alert);
            }

            return $users->count();
        } catch (\Throwable $e) {
            Log::warning('Failed to send bell notification', ['title' => $alert->title, 'error' => $e->getMessage()]);
            return 0;
        }
    }

    /**
     * Remove "needs approval" alerts for a record once it has been decided, so every approver's bell clears.
     */
    public function resolve(string $type, string $key, ?string $id): void
    {
        if (!$id) {
            return;
        }

        try {
            DatabaseNotification::query()
                ->whereRaw("data::jsonb->>'type' = ?", [$type])
                ->whereRaw('data::jsonb->>? = ?', [$key, $id])
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('Failed to resolve bell notifications', ['type' => $type, 'id' => $id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * A new order must be signed off before it can be invoiced. Approval is role-based
     * (Order::INVOICE_APPROVER_ROLES), so the approvers are named by role, not permission.
     * Cleared automatically once invoice_approved_at is set (see AppServiceProvider).
     */
    public function orderAwaitingInvoiceApproval(\App\Models\Order $order, ?string $exceptUserId = null): void
    {
        // Callers create the order inside a transaction; a failed query there would abort the order itself.
        \Illuminate\Support\Facades\DB::afterCommit(fn () => $this->sendOrderAwaitingInvoiceApproval($order, $exceptUserId));
    }

    private function sendOrderAwaitingInvoiceApproval(\App\Models\Order $order, ?string $exceptUserId): void
    {
        try {
            $placeholders = implode(',', array_fill(0, count(\App\Models\Order::INVOICE_APPROVER_ROLES), '?'));
            $approverIds = User::where('company_id', $order->company_id)
                ->whereRaw('users.is_active = true')
                ->whereHas('role', fn ($r) => $r->whereRaw("LOWER(TRIM(name)) IN ({$placeholders})", \App\Models\Order::INVOICE_APPROVER_ROLES))
                ->pluck('id')
                ->all();
        } catch (\Throwable $e) {
            Log::warning('Failed to find order approvers', ['order_id' => $order->id, 'error' => $e->getMessage()]);
            return;
        }

        $customer = $order->customer?->name ?: 'a customer';
        $this->notifyPermission(
            $order->company_id,
            [],
            new SystemAlert(
                'approval',
                "Order {$order->order_number} needs approval",
                "Order for {$customer} is awaiting your approval. Open it to check the items and approve.",
                "/sales/orders/{$order->id}",
                ['type' => 'order_invoice_pending', 'order_id' => $order->id],
            ),
            $exceptUserId,
            $approverIds,
            false,
        );
    }

    public function notifyUser(?string $userId, SystemAlert $alert, ?string $exceptUserId = null): void
    {
        if (!$userId || $userId === $exceptUserId) {
            return;
        }

        try {
            User::find($userId)?->notify($alert);
        } catch (\Throwable $e) {
            Log::warning('Failed to send bell notification', ['title' => $alert->title, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Leave / salary advance: new pending request alerts permission holders plus the employee's named
     * approver; a decision goes back to whoever submitted it and to the employee's own login (matched by email).
     */
    public function hrRequestSaved($request, string $label, string $permission, ?string $namedApproverId, string $url, string $summary): void
    {
        if (!($request->wasRecentlyCreated || $request->wasChanged('status'))) {
            return;
        }
        $employee = $request->employee;
        $employeeName = $employee?->full_name ?: 'An employee';
        $pendingType = str_replace(' ', '_', strtolower($label)) . '_pending';

        if ($request->status === 'pending') {
            $this->notifyPermission(
                $request->company_id,
                [$permission],
                new SystemAlert('approval', "{$label} request from {$employeeName}", $summary, $url, ['type' => $pendingType, 'request_id' => $request->id]),
                $request->created_by,
                [$namedApproverId],
            );
            return;
        }

        $this->resolve($pendingType, 'request_id', $request->id);

        if ($request->wasRecentlyCreated || !in_array($request->status, ['approved', 'rejected'], true)) {
            return;
        }

        try {
            $employeeUserId = $employee?->user_id ?: ($employee?->email
                ? User::where('company_id', $request->company_id)->whereRaw('LOWER(email) = ?', [strtolower($employee->email)])->value('id')
                : null);
        } catch (\Throwable $e) {
            $employeeUserId = null;
        }

        foreach (array_unique(array_filter([$request->created_by, $employeeUserId])) as $userId) {
            $this->notifyDecision($userId, "{$label} request for {$employeeName}", $request->status, $url, $request->approved_by);
        }
    }

    /** Standard "X was approved/rejected" message back to whoever asked. */
    public function notifyDecision(?string $requesterId, string $what, string $decision, ?string $url, ?string $deciderId, ?string $reason = null): void
    {
        try {
            $decider = $deciderId ? User::find($deciderId) : null;
        } catch (\Throwable $e) {
            $decider = null;
        }
        $by = $decider ? " by {$decider->first_name} {$decider->last_name}" : '';
        $verb = str_replace('_', ' ', $decision);

        $this->notifyUser($requesterId, new SystemAlert(
            'approval_result',
            ucfirst("{$what} {$verb}"),
            ucfirst("{$what} was {$verb}{$by}.") . ($reason ? " Note: {$reason}" : ''),
            $url,
            ['type' => 'approval_result', 'decision' => $decision],
        ), $deciderId);
    }
}
