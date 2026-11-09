<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DailyWorkReport extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_id',
        'report_date',
        'designation',
        'department',
        'entries',
        'key_achievements',
        'pending_work',
        'remarks',
        'status',
        'auto_generated',
        'approver_role',
        'approver_id',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'created_by',
    ];

    protected $casts = [
        'report_date' => 'date',
        'entries' => 'array',
        'auto_generated' => 'boolean',
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
    }

    /** Reports for a day close at 12 midnight (Nairobi): open drafts are then forwarded as they stand. */
    public const TIMEZONE = 'Africa/Nairobi';

    /**
     * Submits $employee's report for $data['report_date'], routed to the Directors (a Director's
     * own report is self-certified). $auto marks one forwarded at the midnight close. The day's
     * server draft and "report not sent" reminder are cleared.
     */
    public static function submitFor(Employee $employee, User $user, array $data, bool $auto = false): self
    {
        $user->loadMissing('role');
        $routing = \App\Services\DailyReportRoutingService::resolveApprover($employee, $user);

        $report = self::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'report_date' => $data['report_date'],
            'designation' => ($data['designation'] ?? null) ?: $employee->position ?: ($user->role?->name ?? null),
            'department' => ($data['department'] ?? null) ?: $employee->department,
            'entries' => $data['entries'] ?? [],
            'key_achievements' => $data['key_achievements'] ?? null,
            'pending_work' => $data['pending_work'] ?? null,
            'status' => $routing['auto_approve'] ? 'approved' : 'pending',
            'auto_generated' => $auto,
            'approver_role' => $routing['role'],
            'approver_id' => $routing['user_id'],
            'approved_by' => $routing['auto_approve'] ? $user->id : null,
            'approved_at' => $routing['auto_approve'] ? now() : null,
            'created_by' => $user->id,
        ]);

        DailyWorkReportDraft::where('employee_id', $employee->id)->whereDate('report_date', $data['report_date'])->delete();
        app(\App\Services\NotificationService::class)->resolve('daily_report_reminder', 'reminder_key', self::reminderKey($employee->id, $data['report_date']));

        return $report;
    }

    /**
     * Staff expected to send a report on $date: active employees with a login, not on approved
     * leave that day. Sundays need no report.
     */
    public static function expectedEmployees(string $companyId, $date)
    {
        $day = \Carbon\Carbon::parse($date)->toDateString();
        if (\Carbon\Carbon::parse($day)->isSunday()) {
            return collect();
        }

        return Employee::where('company_id', $companyId)
            ->whereRaw('is_active = true')
            ->whereNotNull('user_id')
            ->whereHas('user', fn ($q) => $q->whereRaw('is_active = true'))
            ->whereDoesntHave('leaveRequests', fn ($q) => $q->where('status', 'approved')
                ->whereDate('start_date', '<=', $day)->whereDate('end_date', '>=', $day))
            ->orderBy('first_name')
            ->get();
    }

    public static function reminderKey(string $employeeId, $date): string
    {
        return $employeeId . ':' . \Carbon\Carbon::parse($date)->toDateString();
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id');
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
}
