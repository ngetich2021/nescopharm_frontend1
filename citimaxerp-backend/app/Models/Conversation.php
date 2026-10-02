<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Conversation extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'customer_id',
        'platform',
        'platform_conversation_id',
        'platform_user_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_profile_picture',
        'status',
        'assigned_agent_id',
        'is_bot_active',
        'last_message_at',
        'last_customer_message_at',
        'last_agent_message_at',
        'unread_count',
        'metadata',
        'tags',
        'notes',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'customer_id' => 'string',
        'assigned_agent_id' => 'string',
        'is_bot_active' => 'boolean',
        'last_message_at' => 'datetime',
        'last_customer_message_at' => 'datetime',
        'last_agent_message_at' => 'datetime',
        'unread_count' => 'integer',
        'metadata' => 'array',
        'tags' => 'array',
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

    // Relationships
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_agent_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->orderBy('created_at', 'desc');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ConversationEvent::class)->orderBy('created_at', 'desc');
    }

    public function credentials(): BelongsTo
    {
        return $this->belongsTo(MetaPlatformCredential::class, 'platform', 'platform')
                    ->where('company_id', $this->company_id);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeForPlatform($query, $platform)
    {
        return $query->where('platform', $platform);
    }

    public function scopeAssignedTo($query, $userId)
    {
        return $query->where('assigned_agent_id', $userId);
    }

    public function scopeUnassigned($query)
    {
        return $query->whereNull('assigned_agent_id');
    }

    public function scopeWithUnreadMessages($query)
    {
        return $query->where('unread_count', '>', 0);
    }

    // Helper Methods
    public function markAsRead(): void
    {
        $this->update(['unread_count' => 0]);
    }

    public function incrementUnreadCount(): void
    {
        $this->increment('unread_count');
    }

    public function updateLastMessageTime(): void
    {
        $this->update(['last_message_at' => now()]);
    }

    public function updateLastCustomerMessageTime(): void
    {
        $this->update(['last_customer_message_at' => now()]);
    }

    public function updateLastAgentMessageTime(): void
    {
        $this->update(['last_agent_message_at' => now()]);
    }

    public function assignToAgent(User $agent): void
    {
        $this->update(['assigned_agent_id' => $agent->id]);
        
        // Log assignment event
        $this->events()->create([
            'event_type' => 'conversation_assigned',
            'triggered_by' => $agent->id,
            'description' => "Conversation assigned to {$agent->first_name} {$agent->last_name}",
        ]);
    }

    public function close(?User $user = null): void
    {
        $this->update(['status' => 'closed']);
        
        // Log close event
        $this->events()->create([
            'event_type' => 'conversation_closed',
            'triggered_by' => $user?->id,
            'description' => 'Conversation closed',
        ]);
    }

    public function reopen(?User $user = null): void
    {
        $this->update(['status' => 'active']);
        
        // Log reopen event
        $this->events()->create([
            'event_type' => 'conversation_reopened',
            'triggered_by' => $user?->id,
            'description' => 'Conversation reopened',
        ]);
    }

    public function addTag(string $tag): void
    {
        $tags = $this->tags ?? [];
        if (!in_array($tag, $tags)) {
            $tags[] = $tag;
            $this->update(['tags' => $tags]);
        }
    }

    public function removeTag(string $tag): void
    {
        $tags = $this->tags ?? [];
        $tags = array_values(array_filter($tags, fn($t) => $t !== $tag));
        $this->update(['tags' => $tags]);
    }

    public function getPlatformIcon(): string
    {
        return match($this->platform) {
            'whatsapp' => '📱',
            'instagram' => '📷',
            'messenger' => '💬',
            default => '💭',
        };
    }

    public function getPlatformColor(): string
    {
        return match($this->platform) {
            'whatsapp' => '#25D366',
            'instagram' => '#E4405F',
            'messenger' => '#0084FF',
            default => '#6B7280',
        };
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsBotActiveAttribute($value)
    {
        $this->attributes['is_bot_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
