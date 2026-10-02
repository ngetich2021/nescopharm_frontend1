<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EtimsSubmissionLog extends Model
{
    public $timestamps = false;
    protected $table = 'etims_submission_logs';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'company_id', 'operation', 'subject_type', 'subject_id',
        'client_request_id', 'request_body_encrypted', 'response_body_encrypted',
        'endpoint', 'http_method', 'status_code', 'result_status', 'latency_ms',
        'actor_user_id', 'request_hash', 'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'status_code' => 'integer',
        'latency_ms' => 'integer',
    ];

    public const OK = 'ok';
    public const FAILED = 'failed';
    public const TIMEOUT = 'timeout';
    public const INVALID_RESPONSE = 'invalid_response';

    protected static function booted(): void
    {
        static::creating(function (self $m) {
            if (empty($m->id)) {
                $m->id = (string) Str::uuid();
            }
            if (empty($m->created_at)) {
                $m->created_at = now();
            }
        });
    }
}
