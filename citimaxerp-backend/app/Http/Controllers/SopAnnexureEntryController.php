<?php

namespace App\Http\Controllers;

use App\Models\Sop;
use App\Models\SopAnnexure;
use App\Models\SopAnnexureEntry;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SopAnnexureEntryController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
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

        return $role->hasPermission($permission);
    }

    protected function getSopAndAnnexure(string $companyId, string $sopId, string $annexureId): array
    {
        $sop = Sop::where('company_id', $companyId)->findOrFail($sopId);
        $annexure = SopAnnexure::where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->findOrFail($annexureId);

        return [$sop, $annexure];
    }

    protected function ensureAssignedUpdater(Request $request, Sop $sop): ?JsonResponse
    {
        if (!$sop->assigned_updater_id) {
            return response()->json([
                'message' => 'No updater is assigned to this SOP. Assign an updater before making annexure updates.',
            ], 400);
        }

        if ($sop->assigned_updater_id !== $request->user()->id) {
            return response()->json([
                'message' => 'Only the assigned updater can create or amend annexure entries for this SOP.',
            ], 403);
        }

        return null;
    }

    public function index(Request $request, string $sopId, string $annexureId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        [$sop, $annexure] = $this->getSopAndAnnexure($companyId, $sopId, $annexureId);

        $query = SopAnnexureEntry::with('updatedBy:id,first_name,last_name,email')
            ->where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->where('sop_annexure_id', $annexure->id);

        if ($request->filled('date_from')) {
            $query->whereDate('entry_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('entry_date', '<=', $request->date_to);
        }

        $perPage = max(1, min((int) $request->get('per_page', 30), 200));
        $entries = $query->orderByDesc('entry_date')->paginate($perPage);

        return response()->json([
            'sop' => $sop->only(['id', 'sop_number', 'title', 'year', 'assigned_updater_id']),
            'annexure' => $annexure->only(['id', 'name', 'update_frequency', 'columns_definition']),
            'entries' => $entries,
        ]);
    }

    public function store(Request $request, string $sopId, string $annexureId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_update_sops', $companyId)
            && !$this->hasPermission($request, 'can_update_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        [$sop, $annexure] = $this->getSopAndAnnexure($companyId, $sopId, $annexureId);
        $updaterValidation = $this->ensureAssignedUpdater($request, $sop);
        if ($updaterValidation) {
            return $updaterValidation;
        }

        $validator = Validator::make($request->all(), [
            'entry_date' => 'required|date',
            'data_payload' => 'required|array',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $alreadyExists = SopAnnexureEntry::where('sop_annexure_id', $annexure->id)
            ->whereDate('entry_date', $request->entry_date)
            ->exists();

        if ($alreadyExists) {
            return response()->json([
                'message' => 'An entry for this annexure and date already exists. Use update instead.',
            ], 422);
        }

        $entry = SopAnnexureEntry::create([
            'sop_annexure_id' => $annexure->id,
            'sop_id' => $sop->id,
            'company_id' => $companyId,
            'entry_date' => $request->entry_date,
            'data_payload' => $request->data_payload,
            'metadata' => $request->metadata,
            'updated_by' => $user->id,
        ]);

        return response()->json([
            'message' => 'SOP annexure entry created successfully',
            'data' => $entry->load('updatedBy:id,first_name,last_name,email'),
        ], 201);
    }

    public function update(Request $request, string $sopId, string $annexureId, string $entryId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_update_sops', $companyId)
            && !$this->hasPermission($request, 'can_update_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        [$sop, $annexure] = $this->getSopAndAnnexure($companyId, $sopId, $annexureId);
        $updaterValidation = $this->ensureAssignedUpdater($request, $sop);
        if ($updaterValidation) {
            return $updaterValidation;
        }

        $entry = SopAnnexureEntry::where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->where('sop_annexure_id', $annexure->id)
            ->findOrFail($entryId);

        $validator = Validator::make($request->all(), [
            'entry_date' => 'sometimes|date',
            'data_payload' => 'sometimes|required|array',
            'metadata' => 'sometimes|nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $updateData = $request->only(['entry_date', 'data_payload', 'metadata']);
        $updateData['updated_by'] = $user->id;

        try {
            $entry->update($updateData);
        } catch (QueryException $e) {
            if (str_contains(strtolower($e->getMessage()), 'unique')) {
                return response()->json([
                    'message' => 'An entry for this annexure and date already exists.',
                ], 422);
            }
            throw $e;
        }

        return response()->json([
            'message' => 'SOP annexure entry updated successfully',
            'data' => $entry->fresh('updatedBy:id,first_name,last_name,email'),
        ]);
    }

    public function destroy(Request $request, string $sopId, string $annexureId, string $entryId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_update_sops', $companyId)
            && !$this->hasPermission($request, 'can_update_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        [$sop, $annexure] = $this->getSopAndAnnexure($companyId, $sopId, $annexureId);
        $updaterValidation = $this->ensureAssignedUpdater($request, $sop);
        if ($updaterValidation) {
            return $updaterValidation;
        }

        $entry = SopAnnexureEntry::where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->where('sop_annexure_id', $annexure->id)
            ->findOrFail($entryId);

        $entry->delete();

        return response()->json(['message' => 'SOP annexure entry deleted successfully']);
    }
}
