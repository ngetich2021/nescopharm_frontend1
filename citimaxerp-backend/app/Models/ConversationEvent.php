<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ConversationEvent extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'conversation_id',
        'event_type',
        'triggered_by',
        'event_data',
        'description',
    ];

    protected $casts = [
        'id' => 'string',
        'conversation_id' => 'string',
        'triggered_by' => 'string',
        'event_data' => 'array',
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
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    // Scopes
    public function scopeByType($query, $type)
    {
        return $query->where('event_type', $type);
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('triggered_by', $userId);
    }

    // Helper Methods
    public function getEventIcon(): string
    {
        return match($this->event_type) {
            'conversation_created' => '🆕',
            'conversation_assigned' => '👤',
            'conversation_closed' => '🔒',
            'conversation_reopened' => '🔓',
            'agent_joined' => '➕',
            'agent_left' => '➖',
            'status_changed' => '🔄',
            'tags_updated' => '🏷️',
            'note_added' => '📝',
            'bot_enabled' => '🤖',
            'bot_disabled' => '🚫',
            default => '📋',
        };
    }

    public function getEventColor(): string
    {
        return match($this->event_type) {
            'conversation_created' => 'green',
            'conversation_assigned' => 'blue',
            'conversation_closed' => 'red',
            'conversation_reopened' => 'green',
            'agent_joined' => 'green',
            'agent_left' => 'orange',
            'status_changed' => 'blue',
            'tags_updated' => 'purple',
            'note_added' => 'gray',
            'bot_enabled' => 'green',
            'bot_disabled' => 'red',
            default => 'gray',
        };
    }
}
