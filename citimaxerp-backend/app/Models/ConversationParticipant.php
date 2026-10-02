<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ConversationParticipant extends Model
{
    protected $fillable = [
        'conversation_id',
        'user_id',
        'participant_id',
        'participant_name',
        'role',
        'joined_at',
        'left_at',
        'is_active',
    ];

    protected $casts = [
        'id' => 'string',
        'conversation_id' => 'string',
        'user_id' => 'string',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public $timestamps = false;

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (!$model->joined_at) {
                $model->joined_at = now();
            }
        });
    }

    // Relationships
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeAgents($query)
    {
        return $query->whereIn('role', ['admin', 'agent']);
    }

    // Helper Methods
    public function leave(): void
    {
        $this->update([
            'is_active' => false,
            'left_at' => now(),
        ]);
    }

    public function rejoin(): void
    {
        $this->update([
            'is_active' => true,
            'left_at' => null,
        ]);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
