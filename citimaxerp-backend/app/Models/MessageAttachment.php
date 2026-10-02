<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class MessageAttachment extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'message_id',
        'filename',
        'original_filename',
        'mime_type',
        'file_size',
        'file_path',
        'file_url',
        'platform_file_id',
        'metadata',
    ];

    protected $casts = [
        'id' => 'string',
        'message_id' => 'string',
        'file_size' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public $timestamps = false;

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            $model->created_at = now();
        });
    }

    // Relationships
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    // Helper Methods
    public function getFileSize(): string
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mime_type, 'image/');
    }

    public function isVideo(): bool
    {
        return str_starts_with($this->mime_type, 'video/');
    }

    public function isAudio(): bool
    {
        return str_starts_with($this->mime_type, 'audio/');
    }

    public function isDocument(): bool
    {
        return !$this->isImage() && !$this->isVideo() && !$this->isAudio();
    }
}
