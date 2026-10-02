<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EtimsWebhookEvent extends Model
{
    public $timestamps = false;
    protected $table = 'etims_webhook_events';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'company_id', 'event_id', 'event_type',
        'subject_type', 'subject_id', 'client_request_id',
        'processing_status', 'last_error', 'payload',
        'received_at', 'processed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'received_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public const RECEIVED = 'received';
    public const PROCESSED = 'processed';
    public const FAILED = 'failed';
    public const IGNORED = 'ignored';

    protected static function booted(): void
    {
        static::creating(function (self $m) {
            if (empty($m->id)) {
                $m->id = (string) Str::uuid();
            }
            if (empty($m->received_at)) {
                $m->received_at = now();
            }
        });
    }
}
