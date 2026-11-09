<?php

namespace App\Http\Controllers;

use App\Models\EmployeeAllowance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class EmployeeAllowanceController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    // -------------------------------------------------------------------------
    // GET /employee-allowances/disbursed?month=YYYY-MM
    // Allowances paid outside payroll, for the HR Allowances page.
    // -------------------------------------------------------------------------

    public function disbursed(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role;
        $allowed = $role && ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company') || $role->hasPermission('can_view_employees'));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $month = preg_match('/^\d{4}-\d{2}$/', (string) $request->input('month')) ? $request->input('month') : now()->format('Y-m');
        $start = \Carbon\Carbon::createFromFormat('Y-m-d', "{$month}-01")->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $rows = EmployeeAllowance::with('employee:id,employee_number,first_name,last_name,department,position,is_active')
            ->where('company_id', $user->company_id)
            ->allowances()
            ->active()
            ->where('frequency', 'disbursed')
            ->whereHas('employee', fn ($q) => $q->whereRaw('is_active = true'))
            ->where(fn ($q) => $q->whereNull('effective_from')->orWhere('effective_from', '<=', $end->toDateString()))
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', $start->toDateString()))
            ->get()
            ->map(fn (EmployeeAllowance $a) => [
                'id' => $a->id,
                'employee_id' => $a->employee_id,
                'employee_number' => $a->employee?->employee_number,
                'employee_name' => trim(($a->employee?->first_name ?? '') . ' ' . ($a->employee?->last_name ?? '')),
                'department' => $a->employee?->department,
                'position' => $a->employee?->position,
                'name' => $a->name,
                'amount' => (float) $a->amount,
                'is_taxable' => (bool) $a->is_taxable,
                // One-time: paid once, on one day (made on this page).
                'one_time' => self::isOneTime($a),
                'date' => self::isOneTime($a) ? $a->effective_from->toDateString() : null,
                'updated_at' => $a->updated_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'status' => 'success',
            'month' => $month,
            'data' => $rows,
            'summary' => [
                'total_amount' => round($rows->sum('amount'), 2),
                'allowance_count' => $rows->count(),
                'employee_count' => $rows->pluck('employee_id')->unique()->count(),
            ],
        ]);
    }

    /** A one-time allowance is a disbursed one that starts and ends on the same day. */
    public static function isOneTime(EmployeeAllowance $a): bool
    {
        return $a->frequency === 'disbursed' && $a->effective_from && $a->effective_to
            && $a->effective_from->toDateString() === $a->effective_to->toDateString();
    }

    private function canManageAllowances(Request $request): bool
    {
        $role = $request->user()->role;
        return $role && collect(['can_manage_system', 'can_manage_company', 'can_update_employees', 'can_create_employees', 'can_manage_payroll'])
            ->contains(fn ($p) => $role->hasPermission($p));
    }

    // -------------------------------------------------------------------------
    // POST /employee-allowances/one-time  {employee_id, name, amount, date, is_taxable}
    // An allowance paid once outside payroll (e.g. a rep's field allowance for a week). It is a
    // "disbursed" allowance dated that one day, so payroll leaves it out and it counts in ROI for Reps.
    // -------------------------------------------------------------------------

    public function storeOneTime(Request $request): JsonResponse
    {
        if (!$this->canManageAllowances($request)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to add allowances.'], 403);
        }
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|uuid',
            'name' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'is_taxable' => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first()], 422);
        }
        $companyId = $request->user()->company_id;
        $employee = \App\Models\Employee::where('company_id', $companyId)->find($request->input('employee_id'));
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'Employee not found.'], 422);
        }
        $date = \Carbon\Carbon::parse($request->input('date'))->toDateString();

        $allowance = EmployeeAllowance::create([
            'employee_id' => $employee->id,
            'company_id' => $companyId,
            'name' => trim($request->input('name')),
            'type' => 'allowance',
            'amount' => round((float) $request->input('amount'), 2),
            'frequency' => 'disbursed',
            'is_taxable' => $request->boolean('is_taxable'),
            'effective_from' => $date,
            'effective_to' => $date,
            'is_active' => true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => trim("{$employee->first_name} {$employee->last_name}") . ': ' . $allowance->name . ' of KES ' . number_format((float) $allowance->amount, 2) . ' recorded.',
            'data' => $allowance,
        ], 201);
    }

    // DELETE /employee-allowances/one-time/{id}: remove a one-time allowance entered by mistake.
    public function destroyOneTime(Request $request, string $id): JsonResponse
    {
        if (!$this->canManageAllowances($request)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to remove allowances.'], 403);
        }
        $allowance = EmployeeAllowance::where('company_id', $request->user()->company_id)->find($id);
        if (!$allowance || !self::isOneTime($allowance)) {
            return response()->json(['status' => 'failed', 'message' => 'Only a one-time allowance can be removed here; change others on the employee.'], 422);
        }
        $allowance->delete();

        return response()->json(['status' => 'success', 'message' => "{$allowance->name} removed."]);
    }

    // -------------------------------------------------------------------------
    // GET /reports/rep-roi?date_from&date_to&group=day|week|month
    // ROI for Reps: what each sales rep was paid in allowances (outside payroll) against what was
    // invoiced under them, per day/week/month in the range. Invoices: by invoice date, the invoice's
    // rep (else its order's), net of credit notes, cancelled and draft left out. Allowances: one-time
    // ones on their date; a monthly disbursed allowance once a month, on the 1st (or its start date).
    // An employee is a rep through the user account linked to them.
    // -------------------------------------------------------------------------

    public function repRoi(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role;
        $allowed = $role && collect(['can_manage_system', 'can_manage_company', 'can_view_reports_menu', 'can_view_employees'])
            ->contains(fn ($p) => $role->hasPermission($p));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $companyId = $user->company_id;
        $from = \Carbon\Carbon::parse($request->input('date_from') ?: now()->startOfMonth())->startOfDay();
        $to = \Carbon\Carbon::parse($request->input('date_to') ?: now())->endOfDay();
        $group = in_array($request->input('group'), ['day', 'week', 'month'], true) ? $request->input('group') : 'week';

        $period = function (\Carbon\Carbon $d) use ($group): array {
            return match ($group) {
                'day' => [$d->toDateString(), $d->toDateString(), $d->toDateString()],
                'month' => [$d->format('Y-m'), $d->copy()->startOfMonth()->toDateString(), $d->copy()->endOfMonth()->toDateString()],
                default => [$d->copy()->startOfWeek()->toDateString(), $d->copy()->startOfWeek()->toDateString(), $d->copy()->endOfWeek()->toDateString()],
            };
        };

        // Reps: employees (by their linked user) and any user invoices are under.
        $employees = \App\Models\Employee::where('company_id', $companyId)
            ->get(['id', 'user_id', 'employee_number', 'first_name', 'last_name', 'department', 'position']);
        $employeeByUser = $employees->whereNotNull('user_id')->keyBy('user_id');

        $cells = []; // repKey => periodKey => [allowance, invoiced, invoices]
        $reps = [];  // repKey => info
        $periods = [];
        $repKey = function (?string $userId, ?string $employeeId) use ($employeeByUser) {
            if ($userId) return 'u:' . $userId;
            return 'e:' . $employeeId;
        };
        $add = function (string $key, \Carbon\Carbon $date, string $field, float $amount, int $count = 0) use (&$cells, &$periods, $period) {
            [$pk, $start, $end] = $period($date);
            $periods[$pk] = [$start, $end];
            $cells[$key][$pk] ??= ['allowance' => 0.0, 'invoiced' => 0.0, 'invoices' => 0];
            $cells[$key][$pk][$field] += $amount;
            $cells[$key][$pk]['invoices'] += $count;
        };

        // Invoices under a rep.
        $invoices = DB::table('invoices as i')
            ->leftJoin('orders as o', 'o.id', '=', 'i.order_id')
            ->where('i.company_id', $companyId)
            ->whereNotIn('i.status', ['cancelled', 'draft'])
            ->whereBetween('i.invoice_date', [$from->toDateString(), $to->toDateString()])
            ->whereRaw('COALESCE(i.sales_rep_id, o.sales_rep_id) IS NOT NULL')
            ->when(Schema::hasColumn('invoices', 'deleted_at'), fn ($q) => $q->whereNull('i.deleted_at'))
            ->select(DB::raw('COALESCE(i.sales_rep_id, o.sales_rep_id) as rep_id'), 'i.invoice_date',
                DB::raw('COALESCE(i.total_amount, 0) - COALESCE(i.amount_credited, 0) as net'))
            ->get();
        foreach ($invoices as $inv) {
            $add($repKey($inv->rep_id, null), \Carbon\Carbon::parse($inv->invoice_date), 'invoiced', (float) $inv->net, 1);
            $reps['u:' . $inv->rep_id] = ['user_id' => $inv->rep_id];
        }

        // Allowances paid outside payroll.
        $allowances = EmployeeAllowance::where('company_id', $companyId)->allowances()->active()
            ->where('frequency', 'disbursed')
            ->where(fn ($q) => $q->whereNull('effective_from')->orWhere('effective_from', '<=', $to->toDateString()))
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', $from->toDateString()))
            ->get();
        $employeesById = $employees->keyBy('id');
        foreach ($allowances as $a) {
            $emp = $employeesById->get($a->employee_id);
            if (!$emp) continue;
            $key = $repKey($emp->user_id, $emp->id);
            $reps[$key] = ['user_id' => $emp->user_id, 'employee_id' => $emp->id];
            if (self::isOneTime($a)) {
                $add($key, $a->effective_from->copy(), 'allowance', (float) $a->amount);
                continue;
            }
            // Monthly: once per month it runs, on the 1st (or the day it starts).
            $month = $from->copy()->startOfMonth();
            while ($month->lte($to)) {
                $day = $a->effective_from && $a->effective_from->gt($month) && $a->effective_from->isSameMonth($month) ? $a->effective_from->copy() : $month->copy();
                $active = (!$a->effective_from || $a->effective_from->lte($month->copy()->endOfMonth()))
                    && (!$a->effective_to || $a->effective_to->gte($month));
                if ($active && $day->betweenIncluded($from, $to)) {
                    $add($key, $day, 'allowance', (float) $a->amount);
                }
                $month->addMonth();
            }
        }

        $users = \App\Models\User::whereIn('id', collect($reps)->pluck('user_id')->filter()->unique()->values())
            ->get(['id', 'first_name', 'last_name', 'email'])->keyBy('id');
        $ratio = fn (float $inv, float $all) => $all > 0 ? round($inv / $all, 2) : null;

        ksort($periods);
        $rows = [];
        $summary = [];
        foreach ($cells as $key => $byPeriod) {
            $info = $reps[$key] ?? [];
            $emp = !empty($info['user_id']) ? $employeeByUser->get($info['user_id']) : $employeesById->get($info['employee_id'] ?? '');
            $u = !empty($info['user_id']) ? $users->get($info['user_id']) : null;
            $name = $emp ? trim("{$emp->first_name} {$emp->last_name}") : ($u ? trim("{$u->first_name} {$u->last_name}") : 'Unknown');
            $rep = [
                'rep_key' => $key,
                'name' => $name ?: ($u->email ?? 'Unknown'),
                'employee_number' => $emp?->employee_number,
                'position' => $emp?->position,
                // An employee with allowances but no user account cannot have invoices under them.
                'linked' => (bool) ($info['user_id'] ?? null),
            ];
            ksort($byPeriod);
            $tAll = 0.0; $tInv = 0.0; $tCount = 0;
            foreach ($byPeriod as $pk => $c) {
                $rows[] = $rep + [
                    'period' => $pk, 'period_start' => $periods[$pk][0], 'period_end' => $periods[$pk][1],
                    'allowance' => round($c['allowance'], 2), 'invoiced' => round($c['invoiced'], 2), 'invoices' => $c['invoices'],
                    'roi' => $ratio($c['invoiced'], $c['allowance']),
                ];
                $tAll += $c['allowance']; $tInv += $c['invoiced']; $tCount += $c['invoices'];
            }
            $summary[] = $rep + ['allowance' => round($tAll, 2), 'invoiced' => round($tInv, 2), 'invoices' => $tCount, 'roi' => $ratio($tInv, $tAll)];
        }
        usort($summary, fn ($a, $b) => $b['invoiced'] <=> $a['invoiced']);
        usort($rows, fn ($a, $b) => [$a['period'], $a['name']] <=> [$b['period'], $b['name']]);
        $totAll = round(array_sum(array_column($summary, 'allowance')), 2);
        $totInv = round(array_sum(array_column($summary, 'invoiced')), 2);

        return response()->json([
            'status' => 'success',
            'date_from' => $from->toDateString(),
            'date_to' => $to->toDateString(),
            'group' => $group,
            'reps' => $summary,
            'rows' => $rows,
            'totals' => ['allowance' => $totAll, 'invoiced' => $totInv, 'invoices' => array_sum(array_column($summary, 'invoices')), 'roi' => $ratio($totInv, $totAll)],
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /employees/{employeeId}/allowances
    // -------------------------------------------------------------------------

    public function index(Request $request, string $employeeId): JsonResponse
    {
        try {
            $allowances = EmployeeAllowance::where('employee_id', $employeeId)
                ->orderByDesc('created_at')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowances retrieved successfully.',
                'data' => $allowances,
            ]);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@index: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve employee allowances.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // POST /employees/{employeeId}/allowances
    // -------------------------------------------------------------------------

    public function store(Request $request, string $employeeId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'type' => 'required|in:allowance,deduction',
            'amount' => 'required|numeric|min:0',
            'frequency' => 'required|string',
            'is_taxable' => 'required|boolean',
            'effective_from' => 'required|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        try {
            $companyId = $request->user()->company_id;

            $allowance = EmployeeAllowance::create(array_merge(
                $validator->validated(),
                [
                    'employee_id' => $employeeId,
                    'company_id' => $companyId,
                    'is_active' => true,
                ]
            ));

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowance created successfully.',
                'data' => $allowance,
            ], 201);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@store: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create employee allowance.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // PUT /employees/{employeeId}/allowances/{id}
    // -------------------------------------------------------------------------

    public function update(Request $request, string $employeeId, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|in:allowance,deduction',
            'amount' => 'sometimes|required|numeric|min:0',
            'frequency' => 'sometimes|required|string',
            'is_taxable' => 'sometimes|required|boolean',
            'effective_from' => 'sometimes|required|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        try {
            $allowance = EmployeeAllowance::where('employee_id', $employeeId)
                ->where('id', $id)
                ->first();

            if (!$allowance) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Employee allowance not found.',
                ], 404);
            }

            $allowance->update($validator->validated());

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowance updated successfully.',
                'data' => $allowance->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@update: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update employee allowance.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /employees/{employeeId}/allowances/{id}
    // -------------------------------------------------------------------------

    public function destroy(string $employeeId, string $id): JsonResponse
    {
        try {
            $allowance = EmployeeAllowance::where('employee_id', $employeeId)
                ->where('id', $id)
                ->first();

            if (!$allowance) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Employee allowance not found.',
                ], 404);
            }

            $allowance->update(['is_active' => false]);

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowance deactivated successfully.',
                'data' => $allowance->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@destroy: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to deactivate employee allowance.',
            ], 500);
        }
    }
}
