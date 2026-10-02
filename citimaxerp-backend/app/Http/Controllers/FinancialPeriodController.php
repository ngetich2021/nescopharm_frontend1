<?php

namespace App\Http\Controllers;

use App\Models\FinancialPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class FinancialPeriodController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
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
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }
    public function index(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial periods.',
            ], 403);
        }
        $query = FinancialPeriod::with('company');
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $companyId);
        }
        if ($request->filled('period_type')) {
            $query->where('period_type', $request->input('period_type'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('year')) {
            $year = $request->input('year');
            $query->whereYear('start_date', $year);
        }
        $periods = $query->orderBy('start_date', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Financial periods retrieved successfully.',
            'periods' => $periods,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $period = FinancialPeriod::with('company')->find($id);

        if (!$period) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Financial period not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $period->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this financial period.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Financial period retrieved successfully.',
            'period' => $period,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'period_type' => 'required|in:monthly,quarterly,semi_annual,annual',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'description' => 'nullable|string',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create financial periods.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $companyId = $request->input('company_id', $user->company_id);

            // Check for overlapping periods
            $overlapping = FinancialPeriod::where('company_id', $companyId)
                ->where(function ($query) use ($request) {
                    $query->whereBetween('start_date', [$request->input('start_date'), $request->input('end_date')])
                        ->orWhereBetween('end_date', [$request->input('start_date'), $request->input('end_date')])
                        ->orWhere(function ($q) use ($request) {
                            $q->where('start_date', '<=', $request->input('start_date'))
                                ->where('end_date', '>=', $request->input('end_date'));
                        });
                })
                ->exists();

            if ($overlapping) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Financial period overlaps with existing period.',
                ], 400);
            }

            // Check if this should be the current period
            $shouldBeCurrent = !FinancialPeriod::where('company_id', $companyId)
                ->where('is_current', true)
                ->exists();

            $period = FinancialPeriod::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $request->input('name'),
                'period_type' => $request->input('period_type'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'status' => 'open',
                'is_current' => $shouldBeCurrent,
                'description' => $request->input('description'),
            ]);

            DB::commit();

            $period->load('company');

            return response()->json([
                'status' => 'success',
                'message' => 'Financial period created successfully.',
                'period' => $period,
            ], 201);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating financial period', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create financial period.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $period = FinancialPeriod::find($id);
        if (!$period) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Financial period not found.',
            ], 404);
        }
        $companyId = $period->company_id;
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this financial period.',
            ], 403);
        }

        if ($period->status === 'closed') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot update closed financial periods.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'period_type' => 'sometimes|required|in:monthly,quarterly,semi_annual,annual',
            'start_date' => 'sometimes|required|date',
            'end_date' => 'sometimes|required|date|after:start_date',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Check for overlapping periods if dates are being updated
            if ($request->has('start_date') || $request->has('end_date')) {
                $startDate = $request->input('start_date', $period->start_date);
                $endDate = $request->input('end_date', $period->end_date);

                $overlapping = FinancialPeriod::where('company_id', $period->company_id)
                    ->where('id', '!=', $period->id)
                    ->where(function ($query) use ($startDate, $endDate) {
                        $query->whereBetween('start_date', [$startDate, $endDate])
                            ->orWhereBetween('end_date', [$startDate, $endDate])
                            ->orWhere(function ($q) use ($startDate, $endDate) {
                                $q->where('start_date', '<=', $startDate)
                                    ->where('end_date', '>=', $endDate);
                            });
                    })
                    ->exists();

                if ($overlapping) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Updated period would overlap with existing period.',
                    ], 400);
                }
            }

            $period->update($request->only([
                'name',
                'period_type',
                'start_date',
                'end_date',
                'description'
            ]));

            DB::commit();

            $period->load('company');

            return response()->json([
                'status' => 'success',
                'message' => 'Financial period updated successfully.',
                'period' => $period,
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating financial period', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update financial period.',
            ], 500);
        }
    }

    public function close(Request $request, $id)
    {
        $period = FinancialPeriod::find($id);

        if (!$period) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Financial period not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $period->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to close this financial period.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_close_financial_periods')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to close financial periods.',
            ], 403);
        }

        if ($period->status !== 'open') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only open periods can be closed.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $period->update([
                'status' => 'closed',
                'is_current' => false,
                'closed_at' => now(),
                'closed_by' => $request->user()->id,
            ]);

            // TODO: Perform year-end closing procedures
            // - Generate closing entries
            // - Transfer profit/loss to retained earnings
            // - Zero out temporary accounts

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Financial period closed successfully.',
                'period' => $period,
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error closing financial period', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to close financial period.',
            ], 500);
        }
    }

    public function reopen(Request $request, $id)
    {
        $period = FinancialPeriod::find($id);

        if (!$period) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Financial period not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $period->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to reopen this financial period.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_reopen_financial_periods')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to reopen financial periods.',
            ], 403);
        }

        if ($period->status !== 'closed') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only closed periods can be reopened.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $period->update([
                'status' => 'open',
                'closed_at' => null,
                'closed_by' => null,
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Financial period reopened successfully.',
                'period' => $period,
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error reopening financial period', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to reopen financial period.',
            ], 500);
        }
    }

    public function setCurrent(Request $request, $id)
    {
        $period = FinancialPeriod::find($id);

        if (!$period) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Financial period not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $period->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to set current financial period.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_set_current_financial_period')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to set current financial period.',
            ], 403);
        }

        if ($period->status !== 'open') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only open periods can be set as current.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Remove current flag from all other periods
            FinancialPeriod::where('company_id', $period->company_id)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            // Set this period as current
            $period->update(['is_current' => true]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Financial period set as current successfully.',
                'period' => $period,
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error setting current financial period', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to set current financial period.',
            ], 500);
        }
    }

    public function getCurrent(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_financial_periods')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial periods.',
            ], 403);
        }

        $query = FinancialPeriod::where('is_current', true);

        // Always default to user's company
        $companyId = $user->company_id;

        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }

        $query->where('company_id', $companyId);

        $currentPeriod = $query->first();

        if (!$currentPeriod) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No current financial period found.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Current financial period retrieved successfully.',
            'period' => $currentPeriod,
        ], 200);
    }

    public function generatePeriods(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'year' => 'required|integer|min:2020|max:2030',
            'period_type' => 'required|in:monthly,quarterly,annual',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to generate financial periods.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $year = $request->input('year');
            $periodType = $request->input('period_type');
            $companyId = $request->input('company_id', $user->company_id);

            $periods = [];

            switch ($periodType) {
                case 'monthly':
                    for ($month = 1; $month <= 12; $month++) {
                        $startDate = Carbon::create($year, $month, 1);
                        $endDate = $startDate->copy()->endOfMonth();

                        $periods[] = [
                            'id' => (string) Str::uuid(),
                            'company_id' => $companyId,
                            'name' => $startDate->format('F Y'),
                            'period_type' => 'monthly',
                            'start_date' => $startDate->format('Y-m-d'),
                            'end_date' => $endDate->format('Y-m-d'),
                            'status' => 'open',
                            'is_current' => $month === 1, // First month is current
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                    break;

                case 'quarterly':
                    $quarters = [
                        ['Q1', 1, 3],
                        ['Q2', 4, 6],
                        ['Q3', 7, 9],
                        ['Q4', 10, 12],
                    ];

                    foreach ($quarters as $index => $quarter) {
                        $startDate = Carbon::create($year, $quarter[1], 1);
                        $endDate = Carbon::create($year, $quarter[2], 1)->endOfMonth();

                        $periods[] = [
                            'id' => (string) Str::uuid(),
                            'company_id' => $companyId,
                            'name' => $quarter[0] . ' ' . $year,
                            'period_type' => 'quarterly',
                            'start_date' => $startDate->format('Y-m-d'),
                            'end_date' => $endDate->format('Y-m-d'),
                            'status' => 'open',
                            'is_current' => $index === 0, // First quarter is current
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                    break;

                case 'annual':
                    $startDate = Carbon::create($year, 1, 1);
                    $endDate = Carbon::create($year, 12, 31);

                    $periods[] = [
                        'id' => (string) Str::uuid(),
                        'company_id' => $companyId,
                        'name' => 'FY ' . $year,
                        'period_type' => 'annual',
                        'start_date' => $startDate->format('Y-m-d'),
                        'end_date' => $endDate->format('Y-m-d'),
                        'status' => 'open',
                        'is_current' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    break;
            }

            // Check for existing periods
            $existingPeriods = FinancialPeriod::where('company_id', $companyId)
                ->whereYear('start_date', $year)
                ->count();

            if ($existingPeriods > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Financial periods already exist for this year.',
                ], 400);
            }

            // Insert periods
            FinancialPeriod::insert($periods);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Financial periods generated successfully.',
                'periods_created' => count($periods),
            ], 201);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error generating financial periods', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate financial periods.',
            ], 500);
        }
    }
}
