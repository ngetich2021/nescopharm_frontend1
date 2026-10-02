<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Message extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'conversation_id',
        'platform_message_id',
        'direction',
        'sender_type',
        'sender_id',
        'sender_name',
        'message_type',
        'content',
        'rich_content',
        'media_url',
        'media_type',
        'media_size',
        'caption',
        'reply_to_message_id',
        'status',
        'delivered_at',
        'read_at',
        'error_message',
        'metadata',
        'reactions',
        'is_deleted',
    ];

    protected $casts = [
        'id' => 'string',
        'conversation_id' => 'string',
        'sender_id' => 'string',
        'reply_to_message_id' => 'string',
        'rich_content' => 'array',
        'media_size' => 'integer',
        'delivered_at' => 'datetime',
        'read_at' => 'datetime',
        'metadata' => 'array',
        'reactions' => 'array',
        'is_deleted' => 'boolean',
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
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyToMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'reply_to_message_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'reply_to_message_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }

    // Scopes
    public function scopeInbound($query)
    {
        return $query->where('direction', 'inbound');
    }

    public function scopeOutbound($query)
    {
        return $query->where('direction', 'outbound');
    }

    public function scopeFromCustomer($query)
    {
        return $query->where('sender_type', 'customer');
    }

    public function scopeFromAgent($query)
    {
        return $query->where('sender_type', 'agent');
    }

    public function scopeFromBot($query)
    {
        return $query->where('sender_type', 'bot');
    }

    public function scopeText($query)
    {
        return $query->where('message_type', 'text');
    }

    public function scopeMedia($query)
    {
        return $query->whereIn('message_type', ['image', 'video', 'audio', 'document']);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at')->where('direction', 'inbound');
    }

    public function scopeNotDeleted($query)
    {
        return $query->where('is_deleted', false);
    }

    // Helper Methods
    public function markAsDelivered(): void
    {
        $this->update([
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
    }

    public function markAsRead(): void
    {
        $this->update([
            'status' => 'read',
            'read_at' => now(),
        ]);
    }

    public function markAsFailed(?string $errorMessage = null): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
        ]);
    }

    public function isFromCustomer(): bool
    {
        return $this->sender_type === 'customer';
    }

    public function isFromAgent(): bool
    {
        return $this->sender_type === 'agent';
    }

    public function isFromBot(): bool
    {
        return $this->sender_type === 'bot';
    }

    public function isInbound(): bool
    {
        return $this->direction === 'inbound';
    }

    public function isOutbound(): bool
    {
        return $this->direction === 'outbound';
    }

    public function hasMedia(): bool
    {
        return in_array($this->message_type, ['image', 'video', 'audio', 'document']);
    }

    public function isText(): bool
    {
        return $this->message_type === 'text';
    }

    public function getFormattedContent(): string
    {
        if ($this->isText()) {
            return $this->content;
        }

        if ($this->hasMedia()) {
            $type = ucfirst($this->message_type);
            $caption = $this->caption ? " - {$this->caption}" : '';
            return "[{$type}]{$caption}";
        }

        return match($this->message_type) {
            'location' => '[Location]',
            'contact' => '[Contact]',
            'sticker' => '[Sticker]',
            'template' => '[Template Message]',
            'interactive' => '[Interactive Message]',
            'reaction' => '[Reaction]',
            'system' => $this->content,
            default => '[Message]',
        };
    }

    public function getFileSize(): string
    {
        if (!$this->media_size) {
            return '';
        }

        $bytes = $this->media_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }

    public function getMediaIcon(): string
    {
        return match($this->message_type) {
            'image' => '🖼️',
            'video' => '🎥',
            'audio' => '🎵',
            'document' => '📄',
            'location' => '📍',
            'contact' => '👤',
            'sticker' => '😀',
            default => '💬',
        };
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsDeletedAttribute($value)
    {
        $this->attributes['is_deleted'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
