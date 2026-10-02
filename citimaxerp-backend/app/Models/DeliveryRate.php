<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DeliveryRate extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'company_id',
        'transporter_name',
        'zone',
        'rate_per_carton',
        'description',
        'status',
        'created_by',
        'approved_by',
        'approved_at',
        'approval_notes',
        'is_active',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        // This connection runs with PDO::ATTR_EMULATE_PREPARES forced on (for
        // PgBouncer compatibility - see DatabaseServiceProvider). Under emulated
        // prepares, PHP bool values get inlined as bare 0/1 integer literals,
        // which Postgres refuses to implicitly cast to its boolean column type
        // ("column is of type boolean but expression is of type integer").
        // Quoted 'true'/'false' string literals *can* be implicitly cast, so we
        // write those instead of raw PHP booleans right before the row is
        // persisted, then restore a real boolean in memory once the write
        // completes (PHP's (bool) cast on the string 'false' is true, so the
        // in-memory value must be fixed back up or reads after save() lie).
        static::saving(function ($model) {
            if (array_key_exists('is_active', $model->attributes)) {
                $model->attributes['is_active'] = filter_var($model->attributes['is_active'], FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
            }
        });

        static::saved(function ($model) {
            if (array_key_exists('is_active', $model->attributes)) {
                $model->attributes['is_active'] = filter_var($model->attributes['is_active'], FILTER_VALIDATE_BOOLEAN);
            }
        });
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function approve($userId, $notes = null)
    {
        $this->update([
            'status' => 'approved',
            'approved_by' => $userId,
            'approved_at' => now(),
            'approval_notes' => $notes,
            'is_active' => true,
        ]);
    }

    public function reject($userId, $notes = null)
    {
        $this->update([
            'status' => 'rejected',
            'approved_by' => $userId,
            'approved_at' => now(),
            'approval_notes' => $notes,
            'is_active' => false,
        ]);
    }
}
