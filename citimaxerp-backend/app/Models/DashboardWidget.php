<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DashboardWidget extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'widget_type',
        'title',
        'description',
        'configuration',
        'size',
        'position_x',
        'position_y',
        'is_active',
        'is_system_widget',
        'permissions',
        'created_by',
    ];

    protected $casts = [
        'configuration' => 'array',
        'permissions' => 'array',
        'is_active' => 'boolean',
        'is_system_widget' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean
        if ($value === null) {
            $this->attributes['is_active'] = 'true'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_active'] = $value ? 'true' : 'false';
        }
    }

    public function setIsSystemWidgetAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean
        if ($value === null) {
            $this->attributes['is_system_widget'] = 'false'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_system_widget'] = $value ? 'true' : 'false';
        }
    }

    /**
     * Get is_active as boolean when retrieving
     */
    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    /**
     * Get is_system_widget as boolean when retrieving
     */
    public function getIsSystemWidgetAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

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
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('widget_type', $type);
    }

    public function scopeSystemWidgets($query)
    {
        return $query->where('is_system_widget', true);
    }

    public function scopeCustomWidgets($query)
    {
        return $query->where('is_system_widget', false);
    }

    // Helper methods
    public function hasPermission($userPermissions)
    {
        if (empty($this->permissions)) {
            return true; // No specific permissions required
        }

        foreach ($this->permissions as $permission) {
            if (isset($userPermissions[$permission]) && $userPermissions[$permission]) {
                return true;
            }
        }

        return false;
    }

    public function getDefaultConfiguration()
    {
        $defaults = [
            'sales_overview' => [
                'show_comparison' => true,
                'comparison_period' => 'previous_month',
                'currency' => 'KES',
            ],
            'revenue_chart' => [
                'chart_type' => 'line',
                'period' => 'last_12_months',
                'group_by' => 'month',
            ],
            'top_products' => [
                'limit' => 10,
                'metric' => 'revenue',
                'period' => 'last_30_days',
            ],
            'customer_insights' => [
                'show_new_customers' => true,
                'show_repeat_customers' => true,
                'period' => 'last_30_days',
            ],
            'expense_summary' => [
                'show_by_category' => true,
                'period' => 'current_month',
            ],
            'cash_flow' => [
                'show_trend' => true,
                'period' => 'last_6_months',
            ],
            'inventory_alerts' => [
                'show_low_stock' => true,
                'show_out_of_stock' => true,
                'threshold_days' => 7,
            ],
            'recent_orders' => [
                'limit' => 5,
                'show_status' => true,
            ],
        ];

        return $defaults[$this->widget_type] ?? [];
    }
}
