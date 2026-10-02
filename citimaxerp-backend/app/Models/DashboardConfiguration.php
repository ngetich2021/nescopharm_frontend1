<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DashboardConfiguration extends Model
{
    use HasFactory;

    /**
     * Handle is_default boolean conversion for PostgreSQL
     */
    public function setIsDefaultAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean
        if ($value === null) {
            $this->attributes['is_default'] = 'true';
        } else {
            $this->attributes['is_default'] = $value ? 'true' : 'false';
        }
    }

    /**
     * Get is_default as boolean when retrieving
     */
    public function getIsDefaultAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'company_id',
        'dashboard_name',
        'layout_configuration',
        'global_filters',
        'refresh_interval',
        'theme',
        'is_default',
        'is_shared',
        'shared_with',
    ];

    protected $casts = [
        'layout_configuration' => 'array',
        'global_filters' => 'array',
        'shared_with' => 'array',
        'is_default' => 'boolean',
        'is_shared' => 'boolean',
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
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Scopes
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeDefault($query)
    {
        // Use whereRaw for PostgreSQL boolean compatibility
        return $query->whereRaw('is_default = true');
    }

    public function scopeShared($query)
    {
        return $query->where('is_shared', true);
    }

    // Helper methods
    public function makeDefault()
    {
        // Remove default flag from other dashboards for this user
        static::where('user_id', $this->user_id)
              ->where('id', '!=', $this->id)
              ->update(['is_default' => false]);
        
        $this->update(['is_default' => true]);
    }

    public function shareWith($userIds)
    {
        $this->update([
            'is_shared' => true,
            'shared_with' => array_unique(array_merge($this->shared_with ?? [], $userIds))
        ]);
    }

    public function unshareWith($userIds)
    {
        $currentSharedWith = $this->shared_with ?? [];
        $newSharedWith = array_diff($currentSharedWith, $userIds);
        
        $this->update([
            'shared_with' => $newSharedWith,
            'is_shared' => !empty($newSharedWith)
        ]);
    }

    public function isSharedWith($userId)
    {
        return $this->is_shared && in_array($userId, $this->shared_with ?? []);
    }

    public function getDefaultLayoutConfiguration()
    {
        return [
            'grid_columns' => 12,
            'grid_rows' => 'auto',
            'widgets' => [
                [
                    'widget_type' => 'sales_overview',
                    'position' => ['x' => 0, 'y' => 0],
                    'size' => ['width' => 6, 'height' => 2],
                    'visible' => true,
                ],
                [
                    'widget_type' => 'revenue_chart',
                    'position' => ['x' => 6, 'y' => 0],
                    'size' => ['width' => 6, 'height' => 2],
                    'visible' => true,
                ],
                [
                    'widget_type' => 'recent_orders',
                    'position' => ['x' => 0, 'y' => 2],
                    'size' => ['width' => 4, 'height' => 2],
                    'visible' => true,
                ],
                [
                    'widget_type' => 'top_products',
                    'position' => ['x' => 4, 'y' => 2],
                    'size' => ['width' => 4, 'height' => 2],
                    'visible' => true,
                ],
                [
                    'widget_type' => 'inventory_alerts',
                    'position' => ['x' => 8, 'y' => 2],
                    'size' => ['width' => 4, 'height' => 2],
                    'visible' => true,
                ],
            ]
        ];
    }
}
