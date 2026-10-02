<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CompanySetting extends Model
{
    use HasFactory;

    protected $table = 'company_settings';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'setting_key',
        'setting_value',
        'description',
        'is_active',
    ];

    protected $casts = [
        'setting_value' => 'array',
        'is_active' => 'bool',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $attributes = [
        'is_active' => true,
    ];

    /**
     * Boot the model
     */
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Company relationship
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get setting value by key for a company
     */
    public static function getSettingValue($companyId, $key, $default = null)
    {
        $setting = static::where('company_id', $companyId)
            ->where('setting_key', $key)
            ->whereRaw("is_active = true")  // Use raw SQL for boolean comparison
            ->first();

        return $setting ? $setting->setting_value : $default;
    }

    /**
     * Set setting value by key for a company
     */
    public static function setSettingValue($companyId, $key, $value, $description = null)
    {
        $setting = static::where('company_id', $companyId)
            ->where('setting_key', $key)
            ->first();

        if ($setting) {
            \Illuminate\Support\Facades\DB::statement(
                "UPDATE company_settings SET setting_value = ?::jsonb, description = ?, is_active = true, updated_at = ? WHERE id = ?",
                [json_encode($value), $description, now(), $setting->id]
            );
            return static::find($setting->id);
        }

        // Use raw SQL for Postgres boolean compatibility
        $id = (string) \Illuminate\Support\Str::uuid();
        \Illuminate\Support\Facades\DB::statement(
            "INSERT INTO company_settings (id, company_id, setting_key, setting_value, description, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, ?::jsonb, ?, ?::boolean, ?, ?)",
            [
                $id,
                $companyId,
                $key,
                json_encode($value),
                $description,
                'true',
                now(),
                now(),
            ]
        );
        
        return static::find($id);
    }

    /**
     * Get dispatch approval settings for a company
     */
    public static function getDispatchApprovalSettings($companyId)
    {
        return static::getSettingValue($companyId, 'dispatch_approval', [
            'default_approvers' => [],
            'require_approval' => true,
        ]);
    }

    /**
     * Set dispatch approval settings for a company
     */
    public static function setDispatchApprovalSettings($companyId, array $settings)
    {
        return static::setSettingValue(
            $companyId,
            'dispatch_approval',
            $settings,
            'Default approval settings for order dispatches'
        );
    }
}
