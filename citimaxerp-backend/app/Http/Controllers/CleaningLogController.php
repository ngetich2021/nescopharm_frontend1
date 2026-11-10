<?php

namespace App\Http\Controllers;

use App\Models\CleaningLog;
use App\Models\User;
use App\Notifications\SystemAlert;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * SOPs > Cleaning Records. The store manager records each cleaning (date, start/end time, areas,
 * cleaner) and picks who checks it; that person is notified, writes a comment and confirms. Past
 * sheets can be typed in on any date or imported (DataImportController 'cleaning_logs').
 */
class CleaningLogController extends Controller
{
    /** Roles holding this may be picked as checkers (GM, Director, Accountant to start with). */
    public const CHECK_PERMISSION = 'can_check_sop_records';

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function can(Request $request, string $permission): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        return $role->hasPermission('can_manage_system')
            || $role->hasPermission('can_manage_company')
            || $role->hasPermission($permission);
    }

    /** GM/Director (company managers): delete, and change a record after it was checked. */
    protected function isManager(Request $request): bool
    {
        $role = $request->user()->role;
        return $role && ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company'));
    }

    public static function userName(?User $user): ?string
    {
        if (!$user) {
            return null;
        }
        $name = trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''));
        return $name !== '' ? $name : $user->email;
    }

    /** Active users of the company whose role may check SOP records - the "Checked By" choices. */
    public static function checkerQuery(string $companyId)
    {
        return User::where('company_id', $companyId)
            ->whereRaw('users.is_active = true')
            ->whereHas('role.permissions', fn ($q) => $q->where('key', self::CHECK_PERMISSION))
            ->with('role:id,name')
            ->orderBy('first_name');
    }

    public function checkers(Request $request): JsonResponse
    {
        if (!$this->can($request, 'can_view_sops')) {
            return response()->json(['message' => 'You do not have access to SOP records.'], 403);
        }

        $users = self::checkerQuery($request->user()->company_id)->get()->map(fn (User $u) => [
            'id' => $u->id,
            'name' => self::userName($u),
            'role' => $u->role?->name,
        ]);

        return response()->json(['status' => 'success', 'data' => $users]);
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->can($request, 'can_view_sops')) {
            return response()->json(['message' => 'You do not have access to SOP records.'], 403);
        }

        $query = CleaningLog::forCompany($request->user()->company_id);
        if ($request->filled('date_from')) {
            $query->whereDate('cleaning_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('cleaning_date', '<=', $request->input('date_to'));
        }
        if (in_array($request->input('status'), [CleaningLog::STATUS_PENDING, CleaningLog::STATUS_CHECKED], true)) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->orderByDesc('cleaning_date')->orderByDesc('start_time')->get(),
            'areas' => CleaningLog::forCompany($request->user()->company_id)->distinct()->orderBy('areas')->pluck('areas'),
            'cleaners' => CleaningLog::forCompany($request->user()->company_id)->whereNotNull('cleaned_by')->distinct()->orderBy('cleaned_by')->pluck('cleaned_by'),
        ]);
    }

    private function rules(bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';
        return [
            'cleaning_date' => "{$req}|date|before_or_equal:today",
            'start_time' => ['nullable', 'regex:/^([01]?\d|2[0-3]):[0-5]\d$/'],
            'end_time' => ['nullable', 'regex:/^([01]?\d|2[0-3]):[0-5]\d$/'],
            'areas' => "{$req}|string|max:255",
            'cleaned_by' => 'nullable|string|max:150',
            'remarks' => 'nullable|string|max:1000',
            'checker_user_id' => "{$req}|uuid",
        ];
    }

    private const MESSAGES = [
        'cleaning_date.before_or_equal' => 'The cleaning date cannot be in the future.',
        'start_time.regex' => 'Start time must be a time like 08:40.',
        'end_time.regex' => 'End time must be a time like 13:00.',
        'checker_user_id.required' => 'Pick who checks this cleaning.',
        'areas.required' => 'Say which areas were cleaned (e.g. All areas, Offices/windows, Holiday).',
    ];

    /** The record's fields from the request, times as HH:MM ("8:40" -> "08:40") so they sort. */
    private function fields(Request $request): array
    {
        $values = $request->only(['cleaning_date', 'start_time', 'end_time', 'areas', 'cleaned_by', 'remarks']);
        foreach (['start_time', 'end_time'] as $t) {
            if (array_key_exists($t, $values)) {
                $values[$t] = $values[$t] ? str_pad((string) $values[$t], 5, '0', STR_PAD_LEFT) : null;
            }
        }
        return $values;
    }

    /** The picked checker, if they belong to this company and may check records. */
    private function checker(Request $request, string $id): ?User
    {
        return self::checkerQuery($request->user()->company_id)->where('id', $id)->first();
    }

    private function notifyChecker(CleaningLog $log, string $preparedBy): void
    {
        app(NotificationService::class)->notifyUser($log->checker_user_id, new SystemAlert(
            'action',
            'Cleaning to check: ' . $log->cleaning_date->format('d/m/Y'),
            "{$preparedBy} recorded cleaning of {$log->areas}" . ($log->cleaned_by ? " by {$log->cleaned_by}" : '') . ' and picked you to check it.',
            '/sops?tab=cleaning',
            ['type' => 'cleaning_check', 'cleaning_log_id' => $log->id],
        ), $log->prepared_by_user_id);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->can($request, 'can_create_sops')) {
            return response()->json(['message' => 'You do not have permission to record cleaning.'], 403);
        }

        $validator = Validator::make($request->all(), $this->rules(true), self::MESSAGES);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $checker = $this->checker($request, $request->input('checker_user_id'));
        if (!$checker) {
            return response()->json(['message' => 'That person cannot check SOP records. Pick someone from the list (their role needs "Check SOP Records" under Users > Roles).'], 422);
        }

        $user = $request->user();
        $log = CleaningLog::create($this->fields($request) + [
            'company_id' => $user->company_id,
            'prepared_by_user_id' => $user->id,
            'prepared_by_name' => self::userName($user),
            'checker_user_id' => $checker->id,
            'checker_name' => self::userName($checker),
            'status' => CleaningLog::STATUS_PENDING,
        ]);

        $this->notifyChecker($log, self::userName($user));

        return response()->json(['status' => 'success', 'message' => 'Cleaning recorded and sent to ' . self::userName($checker) . ' to check.', 'data' => $log], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (!$this->can($request, 'can_update_sops')) {
            return response()->json(['message' => 'You do not have permission to edit cleaning records.'], 403);
        }

        $log = CleaningLog::forCompany($request->user()->company_id)->findOrFail($id);
        if ($log->status === CleaningLog::STATUS_CHECKED && !$this->isManager($request)) {
            return response()->json(['message' => 'This cleaning has already been checked; only the GM or a Director can change it.'], 422);
        }

        $validator = Validator::make($request->all(), $this->rules(false), self::MESSAGES);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $changes = $this->fields($request);
        $newChecker = null;
        if ($request->filled('checker_user_id') && $request->input('checker_user_id') !== $log->checker_user_id) {
            $newChecker = $this->checker($request, $request->input('checker_user_id'));
            if (!$newChecker) {
                return response()->json(['message' => 'That person cannot check SOP records. Pick someone from the list.'], 422);
            }
            // A new checker starts the check afresh.
            $changes += [
                'checker_user_id' => $newChecker->id,
                'checker_name' => self::userName($newChecker),
                'status' => CleaningLog::STATUS_PENDING,
                'checker_comment' => null,
                'checked_at' => null,
            ];
        }

        $log->update($changes);
        if ($newChecker) {
            $this->notifyChecker($log, self::userName($request->user()));
        }

        return response()->json(['status' => 'success', 'message' => 'Cleaning record updated.', 'data' => $log->fresh()]);
    }

    /** The picked checker confirms the cleaning with their comment. */
    public function check(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $log = CleaningLog::forCompany($user->company_id)->findOrFail($id);

        if ($log->checker_user_id !== $user->id) {
            return response()->json(['message' => 'Only ' . ($log->checker_name ?: 'the person picked to check it') . ' can check this cleaning.'], 403);
        }
        if ($log->status === CleaningLog::STATUS_CHECKED) {
            return response()->json(['message' => 'You have already checked this cleaning.'], 422);
        }

        $validator = Validator::make($request->all(), ['comment' => 'required|string|max:1000'], [
            'comment.required' => 'Write a comment on the cleaning before confirming it.',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $log->update([
            'status' => CleaningLog::STATUS_CHECKED,
            'checker_comment' => trim($request->input('comment')),
            'checker_name' => self::userName($user),
            'checked_at' => now(),
        ]);

        app(NotificationService::class)->notifyUser($log->prepared_by_user_id, new SystemAlert(
            'info',
            'Cleaning checked: ' . $log->cleaning_date->format('d/m/Y'),
            self::userName($user) . ' checked the cleaning of ' . $log->areas . ': "' . $log->checker_comment . '"',
            '/sops?tab=cleaning',
            ['type' => 'cleaning_checked', 'cleaning_log_id' => $log->id],
        ), $user->id);

        return response()->json(['status' => 'success', 'message' => 'Cleaning checked.', 'data' => $log->fresh()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!$this->isManager($request)) {
            return response()->json(['message' => 'Only the GM or a Director can delete cleaning records.'], 403);
        }

        CleaningLog::forCompany($request->user()->company_id)->findOrFail($id)->delete();

        return response()->json(['status' => 'success', 'message' => 'Cleaning record deleted.']);
    }
}
