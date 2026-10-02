<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Etims\EtimsSubmissionLog;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Reports → eTIMS Compliance - operationally framed as a worklist (per plan
 * design review: "Reframe Reports as worklist; Replace 'success rate' vanity
 * card with 'Action required: N invoices'").
 *
 *   GET /api/etims/reports/worklist            - action-required cards
 *   GET /api/etims/reports/failures            - grouped failure errors
 *   GET /api/etims/reports/health              - latency / success rate (analytical)
 */
class EtimsReportsController extends Controller
{
    public function worklist(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $now = now();

        $unsubmittedOlderThan24h = Invoice::query()
            ->where('company_id', $companyId)
            ->whereIn('status', ['sent', 'issued', 'approved'])
            ->whereNull('etims_status')
            ->where('created_at', '<', $now->copy()->subHours(24))
            ->count();

        $failedWithRetries = Invoice::query()
            ->where('company_id', $companyId)
            ->where('etims_status', 'failed')
            ->count();

        $stuckLocks = Invoice::query()
            ->where('company_id', $companyId)
            ->where('etims_lock_state', 'locked_pending')
            ->where('etims_lock_acquired_at', '<', $now->copy()->subMinutes(15))
            ->count();

        $unsyncedItems = EtimsItemRegistration::query()
            ->where('company_id', $companyId)
            ->where('sync_status', '!=', EtimsItemRegistration::STATUS_SYNCED)
            ->count();

        return response()->json([
            'cards' => [
                [
                    'key' => 'unsubmitted_older_24h',
                    'title' => 'Unsubmitted invoices > 24h',
                    'count' => $unsubmittedOlderThan24h,
                    'severity' => $unsubmittedOlderThan24h > 0 ? 'critical' : 'ok',
                ],
                [
                    'key' => 'failed',
                    'title' => 'Failed submissions',
                    'count' => $failedWithRetries,
                    'severity' => $failedWithRetries > 0 ? 'warning' : 'ok',
                ],
                [
                    'key' => 'stuck_locks',
                    'title' => 'Stuck locks (>15 min)',
                    'count' => $stuckLocks,
                    'severity' => $stuckLocks > 0 ? 'critical' : 'ok',
                ],
                [
                    'key' => 'unsynced_items',
                    'title' => 'Products not eTIMS-registered',
                    'count' => $unsyncedItems,
                    'severity' => $unsyncedItems > 0 ? 'warning' : 'ok',
                ],
            ],
        ]);
    }

    public function failures(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();

        // Group failed invoices by the leading words of their last error
        $rows = Invoice::query()
            ->where('company_id', $companyId)
            ->where('etims_status', 'failed')
            ->whereNotNull('etims_last_error')
            ->get(['id', 'invoice_number', 'etims_last_error', 'etims_submitted_at']);

        $grouped = $rows->groupBy(function ($r) {
            return mb_substr((string) $r->etims_last_error, 0, 64);
        })->map(function ($group, $errorPrefix) {
            return [
                'error' => $errorPrefix,
                'count' => $group->count(),
                'sample_invoice_ids' => $group->take(5)->pluck('id'),
            ];
        })->values();

        return response()->json(['data' => $grouped]);
    }

    public function health(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $since = now()->subDays(7);

        $totals = EtimsSubmissionLog::query()
            ->where('company_id', $companyId)
            ->where('created_at', '>=', $since)
            ->select('result_status', DB::raw('count(*) as n'), DB::raw('avg(latency_ms) as avg_latency'))
            ->groupBy('result_status')
            ->get();

        return response()->json([
            'window_days' => 7,
            'totals' => $totals,
        ]);
    }

    private function resolveActiveCompanyId(): string
    {
        if (function_exists('active_company_id')) {
            $id = active_company_id();
            if ($id) {
                return (string) $id;
            }
        }
        $user = Auth::user();
        if ($user && $user->company_id) {
            return (string) $user->company_id;
        }
        abort(403, 'Cannot resolve active company.');
    }
}
