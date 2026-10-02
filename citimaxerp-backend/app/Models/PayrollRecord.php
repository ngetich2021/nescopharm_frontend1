<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PayrollRecord extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'payroll_number',
        'pay_period_start',
        'pay_period_end',
        'pay_date',
        'status',
        'total_gross_pay',
        'total_deductions',
        'total_net_pay',
        'total_paye',
        'total_nssf',
        'total_shif',
        'employee_count',
        'created_by',
        'approved_by',
        'approved_at',
        'processed_by',
        'processed_at',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'pay_period_start' => 'date',
        'pay_period_end' => 'date',
        'pay_date' => 'date',
        'total_gross_pay' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'total_net_pay' => 'decimal:2',
        'total_paye' => 'decimal:2',
        'total_nssf' => 'decimal:2',
        'total_shif' => 'decimal:2',
        'employee_count' => 'integer',
        'approved_at' => 'datetime',
        'processed_at' => 'datetime',
        'metadata' => 'array',
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

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function items()
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function processedBy()
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    // Helper methods
    public function approve()
    {
        if ($this->status === 'approved') {
            throw new \Exception('Payroll is already approved');
        }

        $this->update([
            'status' => 'approved',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);
    }

    public function process()
    {
        if ($this->status !== 'approved') {
            throw new \Exception('Payroll must be approved before processing');
        }

        $this->update([
            'status' => 'processed',
            'processed_by' => auth()->id(),
            'processed_at' => now(),
        ]);
    }

    public function calculateTotals()
    {
        $items = $this->items;
        
        $this->update([
            'total_gross_pay' => $items->sum('gross_pay'),
            'total_deductions' => $items->sum('total_deductions'),
            'total_net_pay' => $items->sum('net_pay'),
            'total_paye' => $items->sum('paye_amount'),
            'total_nssf' => $items->sum('nssf_amount'),
            'total_shif' => $items->sum('shif_amount'),
            'employee_count' => $items->count(),
        ]);
    }

    // Scopes
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByPayPeriod($query, $startDate, $endDate)
    {
        return $query->where('pay_period_start', '>=', $startDate)
                    ->where('pay_period_end', '<=', $endDate);
    }
}
