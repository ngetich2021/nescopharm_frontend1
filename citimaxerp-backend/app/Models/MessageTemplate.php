<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class MessageTemplate extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'platform',
        'category',
        'template_type',
        'content',
        'rich_content',
        'variables',
        'language_code',
        'platform_template_id',
        'approval_status',
        'is_active',
        'created_by',
        'additional_info',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'created_by' => 'string',
        'rich_content' => 'array',
        'variables' => 'array',
        'additional_info' => 'array',
        'is_active' => 'boolean',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeApproved($query)
    {
        return $query->where('approval_status', 'approved');
    }

    public function scopeForPlatform($query, $platform)
    {
        return $query->where(function ($q) use ($platform) {
            $q->where('platform', $platform)->orWhere('platform', 'all');
        });
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    // Helper Methods
    public function renderContent(array $variables = []): string
    {
        $content = $this->content;
        
        foreach ($variables as $key => $value) {
            $content = str_replace("{{$key}}", $value, $content);
        }
        
        return $content;
    }

    public function getVariablePlaceholders(): array
    {
        if ($this->variables) {
            return $this->variables;
        }

        // Extract variables from content using {{variable}} pattern
        preg_match_all('/\{\{([^}]+)\}\}/', $this->content, $matches);
        return array_unique($matches[1]);
    }

    public function isApproved(): bool
    {
        return $this->approval_status === 'approved';
    }

    public function approve(): void
    {
        $this->update(['approval_status' => 'approved']);
    }

    public function reject(): void
    {
        $this->update(['approval_status' => 'rejected']);
    }

    public function activate(): void
    {
        $this->update(['is_active' => true]);
    }

    public function deactivate(): void
    {
        $this->update(['is_active' => false]);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
