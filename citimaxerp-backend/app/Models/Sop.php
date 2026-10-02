<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Sop extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'sop_number',
        'title',
        'description',
        'year',
        'status',
        'assigned_updater_id',
        'effective_date',
        'review_date',
        'document_path',
        'storage_disk',
        'original_file_name',
        'mime_type',
        'file_size',
        'metadata',
        'created_by',
    ];

    protected $casts = [
        'year' => 'integer',
        'effective_date' => 'date',
        'review_date' => 'date',
        'file_size' => 'integer',
        'storage_disk' => 'string',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'document_url',
        'document_view_url',
        'document_download_url',
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

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function assignedUpdater()
    {
        return $this->belongsTo(User::class, 'assigned_updater_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function annexures()
    {
        return $this->hasMany(SopAnnexure::class);
    }

    public function comments()
    {
        return $this->hasMany(SopComment::class);
    }

    public function getDocumentUrlAttribute(): ?string
    {
        if (!$this->document_path) {
            return null;
        }

        return $this->getDocumentViewUrlAttribute();
    }

    public function getDocumentViewUrlAttribute(): ?string
    {
        if (!$this->document_path) {
            return null;
        }

        return '/api/sops/' . $this->id . '/document/view';
    }

    public function getDocumentDownloadUrlAttribute(): ?string
    {
        if (!$this->document_path) {
            return null;
        }

        return '/api/sops/' . $this->id . '/document/download';
    }
}
