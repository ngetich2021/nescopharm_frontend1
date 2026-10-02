<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SopAnnexureEntry extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'sop_annexure_id',
        'sop_id',
        'company_id',
        'entry_date',
        'data_payload',
        'metadata',
        'updated_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'data_payload' => 'array',
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

    public function sop()
    {
        return $this->belongsTo(Sop::class);
    }

    public function annexure()
    {
        return $this->belongsTo(SopAnnexure::class, 'sop_annexure_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function comments()
    {
        return $this->hasMany(SopComment::class, 'sop_annexure_entry_id');
    }
}
