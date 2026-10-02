<?php

namespace App\Http\Controllers;

use App\Models\TimeEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TimeEntryController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) return false;
        if ($role->hasPermission('can_manage_system')) return true;
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) return $user->company_id === $resourceCompanyId;
            return true;
        }
        return $role->hasPermission($permission);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_time_management_menu', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $query = TimeEntry::with('employee')->where('company_id', $user->company_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->whereHas('employee', function ($eq) use ($search) {
                    $eq->where('first_name', 'ilike', "%{$search}%")
                       ->orWhere('last_name', 'ilike', "%{$search}%");
                })->orWhere('project', 'ilike', "%{$search}%");
            });
        }

        $entries = $query->orderBy('date', 'desc')->get()->map(function ($entry) {
            return $this->formatEntry($entry);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Time entries retrieved successfully.',
            'time_entries' => $entries,
        ], 200);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_time_management_menu', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|uuid|exists:employees,id',
            'date'        => 'required|date',
            'hours'       => 'required|numeric|min:0.25|max:24',
            'project'     => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $entry = TimeEntry::create([
            'company_id'  => $user->company_id,
            'employee_id' => $request->employee_id,
            'date'        => $request->date,
            'hours'       => $request->hours,
            'project'     => $request->project,
            'description' => $request->description,
            'status'      => 'draft',
            'created_by'  => $user->id,
        ]);

        $entry->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Time entry created successfully.',
            'time_entry' => $this->formatEntry($entry),
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $entry = TimeEntry::with('employee')->find($id);
        if (!$entry) {
            return response()->json(['status' => 'failed', 'message' => 'Time entry not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_time_management_menu', $entry->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Time entry retrieved successfully.',
            'time_entry' => $this->formatEntry($entry),
        ], 200);
    }

    public function update(Request $request, $id)
    {
        $entry = TimeEntry::find($id);
        if (!$entry) {
            return response()->json(['status' => 'failed', 'message' => 'Time entry not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_time_management_menu', $entry->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'employee_id' => 'sometimes|uuid|exists:employees,id',
            'date'        => 'sometimes|date',
            'hours'       => 'sometimes|numeric|min:0.25|max:24',
            'project'     => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status'      => 'sometimes|in:draft,submitted,approved,rejected',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $entry->update($request->only(['employee_id', 'date', 'hours', 'project', 'description', 'status']));
        $entry->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Time entry updated successfully.',
            'time_entry' => $this->formatEntry($entry),
        ], 200);
    }

    public function destroy(Request $request, $id)
    {
        $entry = TimeEntry::find($id);
        if (!$entry) {
            return response()->json(['status' => 'failed', 'message' => 'Time entry not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_time_management_menu', $entry->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $entry->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Time entry deleted successfully.',
        ], 200);
    }

    public function approve(Request $request, $id)
    {
        $entry = TimeEntry::find($id);
        if (!$entry) {
            return response()->json(['status' => 'failed', 'message' => 'Time entry not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_company', $entry->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $entry->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        $entry->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Time entry approved successfully.',
            'time_entry' => $this->formatEntry($entry),
        ], 200);
    }

    private function formatEntry(TimeEntry $entry): array
    {
        $employee = $entry->employee;
        return [
            'id'          => $entry->id,
            'employee_id' => $entry->employee_id,
            'employee'    => $employee ? trim($employee->first_name . ' ' . $employee->last_name) : '',
            'date'        => $entry->date ? $entry->date->format('Y-m-d') : null,
            'hours'       => (string) $entry->hours,
            'project'     => $entry->project,
            'description' => $entry->description ?? '',
            'status'      => $entry->status,
            'created_at'  => $entry->created_at,
            'updated_at'  => $entry->updated_at,
        ];
    }
}
