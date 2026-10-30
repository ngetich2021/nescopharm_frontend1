<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class LeaveRequest extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_id',
        'leave_type',
        'start_date',
        'end_date',
        'reason',
        'status',
        'approved_by',
        'approved_at',
        'created_by',
        'request_date',
        'reporting_date',
        'duration_unit',
        'total_requested',
        'reason_category',
        'balance_days',
        'is_record',
    ];

    // Days allowed per calendar year (Jan to Dec), as printed on the paper leave form.
    // Annual is the form's "Casual leave". Unpaid leave has no allowance, so no balance.
    public const ENTITLEMENTS = [
        'annual' => 21,
        'sick' => 7,
        'paternity' => 14,
        'maternity' => 90,
    ];

    public const HOURS_PER_DAY = 8;

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'request_date' => 'date',
        'reporting_date' => 'date',
        'total_requested' => 'float',
        'balance_days' => 'float',
        'is_record' => 'boolean',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        static::saved(function ($model) {
            app(\App\Services\NotificationService::class)->hrRequestSaved(
                $model,
                'Leave',
                'can_approve_leave',
                $model->employee?->leave_approver_id,
                '/hr/leave-management',
                ucfirst(str_replace('_', ' ', (string) $model->leave_type)) . ' leave ' . $model->start_date?->format('d M') . ' – ' . $model->end_date?->format('d M Y') . '.',
            );
        });
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /** Validation for the paper-form fields, shared by the HR and employee-portal endpoints. */
    public static function formRules(): array
    {
        return [
            'request_date' => 'nullable|date',
            'reporting_date' => 'nullable|date',
            'duration_unit' => 'nullable|in:hours,day,days',
            'total_requested' => 'nullable|numeric|min:0',
            'reason_category' => 'nullable|in:personal,medical,religious,other',
            'balance_days' => 'nullable|numeric',
            'approved_on' => 'nullable|date',
        ];
    }

    /**
     * Saves new leave for $employee. Leave starting today or earlier (Nairobi time) is being
     * captured after the fact, so it goes in as a record already approved by the GM, on the
     * date given (the paper form's approval date) or else its start date. Later leave waits
     * for approval as before. The balance is the one written on the form, or worked out.
     */
    public static function createFor(Employee $employee, array $input, User $creator): self
    {
        $lr = new self(array_merge(
            ['leave_type' => $input['leave_type'], 'start_date' => $input['start_date'], 'end_date' => $input['end_date']],
            self::formAttributes($input),
            [
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'reason' => (string) ($input['reason'] ?? ''),
                'request_date' => $input['request_date'] ?? now('Africa/Nairobi')->toDateString(),
                'status' => 'pending',
                'created_by' => $creator->id,
            ],
        ));

        if ($lr->start_date->toDateString() <= now('Africa/Nairobi')->toDateString()) {
            $lr->is_record = true;
            $lr->status = 'approved';
            $lr->approved_by = self::recordsApprover($employee->company_id)?->id ?? $employee->leave_approver_id;
            $lr->approved_at = $input['approved_on'] ?? $lr->start_date;
        }

        if (!array_key_exists('balance_days', $input) || $input['balance_days'] === null || $input['balance_days'] === '') {
            $lr->balance_days = $lr->computeBalance();
        }

        $lr->save();
        return $lr->load(['employee', 'approvedBy']);
    }

    /** The paper-form fields present in $input, ready to fill. */
    public static function formAttributes(array $input): array
    {
        $attrs = array_intersect_key($input, array_flip(['request_date', 'reporting_date', 'duration_unit', 'total_requested', 'reason_category', 'balance_days']));
        return array_map(fn ($v) => $v === '' ? null : $v, $attrs);
    }

    /** Who signs off leave entered as a record: the company's General Manager. */
    public static function recordsApprover(string $companyId): ?User
    {
        return User::where('company_id', $companyId)
            ->whereHas('role', fn ($q) => $q->where('name', 'GM'))
            ->orderBy('created_at')
            ->first();
    }

    /** Leave days this request takes: the total on the form (hours count as part days), else start to end. */
    public function daysTaken(): float
    {
        if ($this->total_requested !== null) {
            return $this->duration_unit === 'hours'
                ? round($this->total_requested / self::HOURS_PER_DAY, 2)
                : (float) $this->total_requested;
        }
        return $this->start_date && $this->end_date ? $this->start_date->diffInDays($this->end_date) + 1 : 0;
    }

    /** Days left of this leave type for the year once this request is taken, or null when the type has no allowance. */
    public function computeBalance(): ?float
    {
        if (!isset(self::ENTITLEMENTS[$this->leave_type]) || !$this->start_date) return null;
        return round(self::balanceBefore($this->employee_id, $this->leave_type, $this->start_date->year, $this->id) - $this->daysTaken(), 2);
    }

    /**
     * Days of $type left in $year from the employee's approved leave (leaving out $exceptId).
     * A balance written on a paper form is taken as true from then on, since leave taken before
     * the system isn't in it: count down from the latest one, else from the yearly allowance.
     */
    public static function balanceBefore(string $employeeId, string $type, int $year, ?string $exceptId = null): float
    {
        $taken = self::where('employee_id', $employeeId)
            ->where('leave_type', $type)
            ->where('status', 'approved')
            ->whereYear('start_date', $year)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->orderBy('start_date')
            ->orderBy('created_at')
            ->get();

        $anchor = $taken->filter(fn (self $lr) => $lr->is_record && $lr->balance_days !== null)->last();
        $after = $anchor ? $taken->slice($taken->search($anchor) + 1) : $taken;
        $start = $anchor ? (float) $anchor->balance_days : (float) self::ENTITLEMENTS[$type];

        return round($start - $after->sum(fn (self $lr) => $lr->daysTaken()), 2);
    }

    /** Allowance, used and left for each leave type with an allowance, this year. */
    public static function balancesFor(Employee $employee, ?int $year = null): array
    {
        $year ??= now('Africa/Nairobi')->year;
        $out = [];
        foreach (self::ENTITLEMENTS as $type => $allowance) {
            $balance = self::balanceBefore($employee->id, $type, $year);
            $out[] = ['leaveType' => $type, 'allowance' => $allowance, 'used' => round($allowance - $balance, 2), 'balance' => $balance];
        }
        return $out;
    }

    public function toApiArray(): array
    {
        $employee = $this->employee;
        $approver = $this->approvedBy;
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'employee' => $employee ? trim($employee->first_name . ' ' . $employee->last_name) : '',
            'department' => $employee?->department,
            'leaveType' => $this->leave_type,
            'startDate' => $this->start_date?->format('Y-m-d'),
            'endDate' => $this->end_date?->format('Y-m-d'),
            'requestDate' => $this->request_date?->format('Y-m-d'),
            'reportingDate' => $this->reporting_date?->format('Y-m-d'),
            'durationUnit' => $this->duration_unit,
            'totalRequested' => $this->total_requested,
            'daysTaken' => $this->daysTaken(),
            'reasonCategory' => $this->reason_category,
            'reason' => $this->reason,
            'balanceDays' => $this->balance_days,
            'isRecord' => (bool) $this->is_record,
            'status' => $this->status,
            'approvedBy' => $approver ? trim($approver->first_name . ' ' . $approver->last_name) : null,
            'approvedAt' => $this->approved_at?->format('Y-m-d'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
