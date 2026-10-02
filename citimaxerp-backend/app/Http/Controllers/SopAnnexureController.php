<?php

namespace App\Http\Controllers;

use App\Models\Sop;
use App\Models\SopAnnexure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SopAnnexureController extends Controller
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

    protected function getSopOrFail(string $companyId, string $sopId): Sop
    {
        return Sop::where('company_id', $companyId)->findOrFail($sopId);
    }

    public function index(Request $request, string $sopId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = $this->getSopOrFail($companyId, $sopId);
        $annexures = SopAnnexure::with('createdBy:id,first_name,last_name,email')
            ->withCount('entries')
            ->where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'sop' => $sop->only(['id', 'sop_number', 'title', 'year', 'status', 'assigned_updater_id']),
            'annexures' => $annexures,
        ]);
    }

    public function store(Request $request, string $sopId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_update_sops', $companyId)
            && !$this->hasPermission($request, 'can_update_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = $this->getSopOrFail($companyId, $sopId);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'update_frequency' => 'sometimes|string|in:daily,weekly,monthly,quarterly,yearly,ad_hoc',
            'columns_definition' => 'required|array|min:1',
            'is_active' => 'sometimes|boolean',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $annexure = SopAnnexure::create([
            'sop_id' => $sop->id,
            'company_id' => $companyId,
            'name' => $request->name,
            'description' => $request->description,
            'update_frequency' => $request->update_frequency ?? 'daily',
            'columns_definition' => $request->columns_definition,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
            'metadata' => $request->metadata,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'message' => 'SOP annexure created successfully',
            'data' => $annexure->load('createdBy:id,first_name,last_name,email'),
        ], 201);
    }

    public function update(Request $request, string $sopId, string $annexureId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_update_sops', $companyId)
            && !$this->hasPermission($request, 'can_update_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = $this->getSopOrFail($companyId, $sopId);
        $annexure = SopAnnexure::where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->findOrFail($annexureId);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|nullable|string',
            'update_frequency' => 'sometimes|string|in:daily,weekly,monthly,quarterly,yearly,ad_hoc',
            'columns_definition' => 'sometimes|required|array|min:1',
            'is_active' => 'sometimes|boolean',
            'metadata' => 'sometimes|nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $annexure->update($request->only([
            'name',
            'description',
            'update_frequency',
            'columns_definition',
            'is_active',
            'metadata',
        ]));

        return response()->json([
            'message' => 'SOP annexure updated successfully',
            'data' => $annexure->fresh('createdBy:id,first_name,last_name,email'),
        ]);
    }

    public function destroy(Request $request, string $sopId, string $annexureId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_delete_sops', $companyId)
            && !$this->hasPermission($request, 'can_delete_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = $this->getSopOrFail($companyId, $sopId);
        $annexure = SopAnnexure::where('company_id', $companyId)
            ->where('sop_id', $sop->id)
            ->findOrFail($annexureId);

        $annexure->delete();

        return response()->json(['message' => 'SOP annexure deleted successfully']);
    }
}
