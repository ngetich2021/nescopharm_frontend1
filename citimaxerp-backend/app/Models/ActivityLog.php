<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ActivityLog extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'activity_logs';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'company_id',
        'action',
        'description',
        'ip_address',
        'user_agent',
        'properties',
        'created_at',
    ];

    protected $casts = [
        'id' => 'string',
        'user_id' => 'string',
        'company_id' => 'string',
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    /**
     * Log an activity
     */
    public static function logActivity(string $action, string $description, $user = null, array $properties = [])
    {
        if (!$user) {
            $user = auth()->user();
        }

        if (!$user) {
            return null;
        }

        return self::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => $action,
            'description' => $description,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'properties' => $properties,
            'created_at' => now(),
        ]);
    }
}
