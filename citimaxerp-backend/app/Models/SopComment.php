<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SopComment extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'sop_id',
        'sop_annexure_id',
        'sop_annexure_entry_id',
        'company_id',
        'commented_by',
        'comment_type',
        'comment',
        'metadata',
        'file_path',
        'file_name',
        'file_type',
        'file_size',
    ];

    protected $casts = [
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

    public function annexureEntry()
    {
        return $this->belongsTo(SopAnnexureEntry::class, 'sop_annexure_entry_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function commentedBy()
    {
        return $this->belongsTo(User::class, 'commented_by');
    }
}
