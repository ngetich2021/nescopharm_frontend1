<?php

namespace App\Http\Controllers;

use App\Models\TemperatureLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TemperatureLogController extends Controller
{
    // Morning readings must be captured before noon, afternoon ones from
    // noon onward - matches the physical routine (open-of-day vs midday
    // check) and stops a reading being backfilled outside the window it's
    // meant to represent. Only enforced for today's row; past dates can
    // still be corrected any time. These must meet at the same hour - a gap
    // between them (e.g. cutoff 10, start 12) makes both windows closed for
    // anyone logging in between, which is exactly what broke capture here.
    protected const MORNING_CUTOFF_HOUR = 12;
    protected const AFTERNOON_START_HOUR = 12;

    // config('app.timezone') is UTC - stores are physically in East Africa
    // (UTC+3), so comparing against raw UTC now() put the window 3 hours
    // behind the wall clock (e.g. rejecting an afternoon reading at 2pm
    // local because the server still thought it was 11am). Every "what time
    // is it right now" check in this controller must go through this.
    protected const BUSINESS_TIMEZONE = 'Africa/Nairobi';

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Reject a morning/afternoon value that's actually changing (not just
     * being resent unchanged as part of a full-form update) outside its
     * capture window, for a reading dated today.
     *
     * @return string|null error message, or null if allowed
     */
    protected function captureWindowError(Request $request, ?TemperatureLog $existing): ?string
    {
        $nowLocal = now()->setTimezone(self::BUSINESS_TIMEZONE);

        $logDate = $request->input('log_date', $existing?->log_date?->toDateString());
        if (!$logDate || !Carbon::parse($logDate, self::BUSINESS_TIMEZONE)->isSameDay($nowLocal)) {
            return null;
        }

        $hour = $nowLocal->hour;

        if ($request->has('morning_temp')) {
            $new = $request->input('morning_temp');
            $old = $existing?->morning_temp;
            $changed = $new !== null && (float) $new !== (float) ($old ?? 0);
            if ($changed && $hour >= self::MORNING_CUTOFF_HOUR) {
                return 'Morning readings can only be logged before ' . self::MORNING_CUTOFF_HOUR . ':00.';
            }
        }

        if ($request->has('afternoon_temp')) {
            $new = $request->input('afternoon_temp');
            $old = $existing?->afternoon_temp;
            $changed = $new !== null && (float) $new !== (float) ($old ?? 0);
            if ($changed && $hour < self::AFTERNOON_START_HOUR) {
                return 'Afternoon readings can only be logged from ' . self::AFTERNOON_START_HOUR . ':00.';
            }
        }

        return null;
    }

    protected function hasPermission(Request $request, string $permission, ?string $resourceCompanyId = null): bool
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }

        if ($role->hasPermission('can_manage_system')) {
            return true;
        }

        if ($role->hasPermission('can_manage_company')) {
            return $resourceCompanyId === null || $user->company_id === $resourceCompanyId;
        }

        // Temperature records are a sub-feature of SOPs/compliance - reuse
        // those permissions rather than adding a whole new permission set.
        return $role->hasPermission($permission) || $role->hasPermission('can_view_sops');
    }

    /**
     * Deleting a temperature log is reserved for GM/Director specifically -
     * unlike every other action here, it deliberately does NOT fall back to
     * can_delete_sops/can_view_sops, since store staff logging readings
     * shouldn't also be able to erase them.
     */
    protected function isGmOrDirector(Request $request, ?string $resourceCompanyId = null): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            return $resourceCompanyId === null || $request->user()->company_id === $resourceCompanyId;
        }
        return false;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_sops', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = TemperatureLog::forCompany($companyId);

        if ($request->filled('thermometer_name')) {
            $query->where('thermometer_name', $request->input('thermometer_name'));
        }
        if ($request->filled('month')) {
            // Expected as YYYY-MM.
            $query->whereRaw("to_char(log_date, 'YYYY-MM') = ?", [$request->input('month')]);
        }
        if ($request->filled('date_from')) {
            $query->where('log_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('log_date', '<=', $request->input('date_to'));
        }

        $logs = $query->orderBy('log_date', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $logs,
            'thermometers' => TemperatureLog::forCompany($companyId)->distinct()->pluck('thermometer_name'),
            'areas' => TemperatureLog::forCompany($companyId)->whereNotNull('area_room')->distinct()->pluck('area_room'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_create_sops', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'thermometer_name' => 'required|string|max:100',
            'area_room' => 'nullable|string|max:100',
            'acceptance_max_celsius' => 'nullable|numeric',
            'log_date' => 'required|date',
            'morning_temp' => 'nullable|numeric',
            'afternoon_temp' => 'nullable|numeric',
            'checked_by' => 'nullable|string|max:150',
            'remarks' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        if ($error = $this->captureWindowError($request, null)) {
            return response()->json(['message' => $error], 422);
        }

        $existing = TemperatureLog::forCompany($companyId)
            ->where('thermometer_name', $request->thermometer_name)
            ->whereDate('log_date', $request->log_date)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'A reading for this thermometer and date already exists - edit it instead.',
                'existing_id' => $existing->id,
            ], 409);
        }

        $log = TemperatureLog::create(array_merge($request->only([
            'thermometer_name', 'area_room', 'acceptance_max_celsius', 'log_date',
            'morning_temp', 'afternoon_temp', 'checked_by', 'remarks',
        ]), [
            'company_id' => $companyId,
            'created_by' => $user->id,
        ]));

        return response()->json(['status' => 'success', 'data' => $log], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_sops', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $log = TemperatureLog::forCompany($companyId)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'thermometer_name' => 'sometimes|string|max:100',
            'area_room' => 'nullable|string|max:100',
            'acceptance_max_celsius' => 'nullable|numeric',
            'log_date' => 'sometimes|date',
            'morning_temp' => 'nullable|numeric',
            'afternoon_temp' => 'nullable|numeric',
            'checked_by' => 'nullable|string|max:150',
            'remarks' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        if ($error = $this->captureWindowError($request, $log)) {
            return response()->json(['message' => $error], 422);
        }

        $log->update($request->only([
            'thermometer_name', 'area_room', 'acceptance_max_celsius', 'log_date',
            'morning_temp', 'afternoon_temp', 'checked_by', 'remarks',
        ]));

        return response()->json(['status' => 'success', 'data' => $log->fresh()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->isGmOrDirector($request, $companyId)) {
            return response()->json(['message' => 'Only GM or Directors can delete temperature logs.'], 403);
        }

        $log = TemperatureLog::forCompany($companyId)->findOrFail($id);
        $log->delete();

        return response()->json(['status' => 'success', 'message' => 'Temperature log deleted']);
    }
}
