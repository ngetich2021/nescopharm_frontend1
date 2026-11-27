<?php

namespace App\Http\Controllers;

use App\Models\DepreciationRun;
use App\Services\DepreciationJournalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Assets > Depreciation Journal: the monthly depreciation journal (DEP/YYYY/MM) from the Fixed Asset
 * Register, its checks, posting log and register-to-GL reconciliation; post, reverse and catch up.
 */
class DepreciationJournalController extends Controller
{
    public function __construct(private readonly DepreciationJournalService $service)
    {
        $this->middleware('auth:sanctum');
    }

    private function can(Request $request, array $permissions): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        foreach (array_merge(['can_manage_system', 'can_manage_company'], $permissions) as $p) {
            if ($role->hasPermission($p)) {
                return true;
            }
        }
        return false;
    }

    private function canView(Request $request): bool
    {
        return $this->can($request, ['can_view_assets', 'can_view_assets_menu', 'can_view_journal_entries', 'can_view_general_ledger', 'can_manage_all_finance']);
    }

    private function canPost(Request $request): bool
    {
        return $this->can($request, ['can_post_journal_entries', 'can_manage_all_finance', 'can_calculate_depreciation']);
    }

    private function denied(string $what): JsonResponse
    {
        return response()->json(['status' => 'failed', 'message' => "You do not have permission to {$what}."], 403);
    }

    // GET /depreciation-journal?month=2026-11
    public function show(Request $request): JsonResponse
    {
        if (!$this->canView($request)) {
            return $this->denied('view the depreciation journal');
        }
        $request->validate(['month' => 'nullable|date']);
        $month = $request->input('month');
        $month = $month && preg_match('/^\d{4}-\d{2}$/', $month) ? "{$month}-01" : ($month ?: now()->toDateString());
        try {
            $data = $this->service->month($request->user()->company_id, $month);
            $data['can_post_permission'] = $this->canPost($request);
            return response()->json(['status' => 'success', 'data' => $data]);
        } catch (\Throwable $e) {
            Log::error('DepreciationJournalController@show: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['status' => 'failed', 'message' => 'Could not work out the depreciation journal.'], 500);
        }
    }

    // POST /depreciation-journal/accounts - add the 1007xx / 6700xx accounts that are missing
    public function setupAccounts(Request $request): JsonResponse
    {
        if (!$this->canPost($request)) {
            return $this->denied('set up the depreciation accounts');
        }
        try {
            $created = $this->service->ensureAccounts($request->user()->company_id);
            return response()->json([
                'status' => 'success',
                'message' => $created ? count($created) . ' account(s) added to the chart of accounts.' : 'All the accounts were already in the chart of accounts.',
                'data' => $created,
            ]);
        } catch (\Throwable $e) {
            Log::error('DepreciationJournalController@setupAccounts: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => 'Could not add the accounts: ' . $e->getMessage()], 500);
        }
    }

    // POST /depreciation-journal/post {month, reviewed_by?, posting_date?}
    public function post(Request $request): JsonResponse
    {
        if (!$this->canPost($request)) {
            return $this->denied('post the depreciation journal');
        }
        $data = $request->validate([
            'month' => 'required|date',
            'reviewed_by' => 'nullable|string|max:120',
            'posting_date' => 'nullable|date',
        ]);
        try {
            $run = $this->service->post($request->user()->company_id, $data['month'], $request->user(), $data['reviewed_by'] ?? null, $data['posting_date'] ?? null);
            return response()->json([
                'status' => 'success',
                'message' => "{$run->reference} posted (entry {$run->journalEntry?->entry_number}): KES " . number_format((float) $run->total_charge, 2) . '.',
                'data' => ['id' => $run->id, 'reference' => $run->reference, 'entry_number' => $run->journalEntry?->entry_number],
            ]);
        } catch (\DomainException $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            Log::error('DepreciationJournalController@post: ' . $e->getMessage());
            $msg = str_contains($e->getMessage(), 'depreciation_runs_one_posted_per_month')
                ? 'This month was posted a moment ago by someone else.'
                : 'Could not post the depreciation journal: ' . $e->getMessage();
            return response()->json(['status' => 'failed', 'message' => $msg], 500);
        }
    }

    // POST /depreciation-journal/post-missing {up_to, reviewed_by?} - every month not yet posted, oldest first
    public function postMissing(Request $request): JsonResponse
    {
        if (!$this->canPost($request)) {
            return $this->denied('post the depreciation journal');
        }
        $data = $request->validate(['up_to' => 'required|date', 'reviewed_by' => 'nullable|string|max:120']);
        try {
            $done = $this->service->postMissing($request->user()->company_id, $data['up_to'], $request->user(), $data['reviewed_by'] ?? null);
            $total = array_sum(array_column($done, 'charge'));
            return response()->json([
                'status' => 'success',
                'message' => $done
                    ? count($done) . ' month(s) posted (' . $done[0]['reference'] . ' to ' . end($done)['reference'] . '): KES ' . number_format($total, 2) . '.'
                    : 'Every month up to then is already posted.',
                'data' => $done,
            ]);
        } catch (\DomainException $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            Log::error('DepreciationJournalController@postMissing: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => 'Could not post the months: ' . $e->getMessage()], 500);
        }
    }

    // POST /depreciation-journal/{run}/reverse {reason}
    public function reverse(Request $request, string $runId): JsonResponse
    {
        if (!$this->can($request, ['can_reverse_journal_entries', 'can_manage_all_finance'])) {
            return $this->denied('reverse the depreciation journal');
        }
        $data = $request->validate(['reason' => 'required|string|min:3|max:255']);
        $run = DepreciationRun::where('company_id', $request->user()->company_id)->find($runId);
        if (!$run) {
            return response()->json(['status' => 'failed', 'message' => 'Depreciation journal not found.'], 404);
        }
        try {
            $run = $this->service->reverse($run, $request->user(), $data['reason']);
            return response()->json(['status' => 'success', 'message' => "{$run->reference} reversed. The month can be posted again."]);
        } catch (\DomainException $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            Log::error('DepreciationJournalController@reverse: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => 'Could not reverse the journal: ' . $e->getMessage()], 500);
        }
    }
}
