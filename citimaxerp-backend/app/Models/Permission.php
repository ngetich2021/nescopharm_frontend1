<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Permission extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'permissions';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'key',
        'description',
        'category',
        'company_id',
        'is_system',
        'is_active',
        'created_by',
        'metadata',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'created_by' => 'string',
        'is_system' => 'boolean',
        'is_active' => 'boolean',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Permission belongs to a company (null for system permissions)
     */
    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    /**
     * Permission created by user
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    /**
     * Roles that have this permission
     */
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_permissions', 'permission_id', 'role_id');
    }

    /**
     * Get system permissions (available to all companies)
     */
    public static function getSystemPermissions()
    {
        return self::whereRaw('is_system = true')
                   ->whereRaw('is_active = true')
                   ->orderBy('category')
                   ->orderBy('name')
                   ->get();
    }

    /**
     * Get company-specific permissions
     */
    public static function getCompanyPermissions($companyId)
    {
        return self::where('company_id', $companyId)
                   ->whereRaw('is_active = true')
                   ->orderBy('category')
                   ->orderBy('name')
                   ->get();
    }

    /**
     * Get all available permissions for a company (system + company-specific)
     */
    public static function getAvailablePermissions($companyId = null)
    {
        $query = self::whereRaw('is_active = true')
                     ->where(function ($q) use ($companyId) {
                         $q->whereRaw('is_system = true');
                         if ($companyId) {
                             $q->orWhere('company_id', $companyId);
                         }
                     });

        return $query->orderBy('category')
                    ->orderBy('name')
                    ->get()
                    ->groupBy('category');
    }

    /**
     * Create permission key from name
     */
    public static function generateKey($name)
    {
        $key = strtolower(str_replace([' ', '-', '_'], '_', trim($name)));
        if (strpos($key, 'can_') === 0) {
            return $key;
        }
        return 'can_' . $key;
    }

    /**
     * Check if permission key already exists
     */
    public static function keyExists($key, $companyId = null)
    {
        $query = self::where('key', $key);
        
        if ($companyId) {
            $query->where(function ($q) use ($companyId) {
                $q->whereRaw('is_system = true')
                  ->orWhere('company_id', $companyId);
            });
        } else {
            $query->whereRaw('is_system = true');
        }

        return $query->exists();
    }

    /**
     * Get permission categories
     */
    public static function getCategories($companyId = null)
    {
        $query = self::whereRaw('is_active = true');
        
        if ($companyId) {
            $query->where(function ($q) use ($companyId) {
                $q->whereRaw('is_system = true')
                  ->orWhere('company_id', $companyId);
            });
        } else {
            $query->whereRaw('is_system = true');
        }

        return $query->distinct()
                    ->pluck('category')
                    ->filter()
                    ->sort()
                    ->values();
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsSystemAttribute($value)
    {
        // Store as 'true'/'false' string for PostgreSQL compatibility
        if ($value === null) {
            $this->attributes['is_system'] = 'false';
        } else {
            $this->attributes['is_system'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
        }
    }

    public function setIsActiveAttribute($value)
    {
        // Store as 'true'/'false' string for PostgreSQL compatibility
        if ($value === null) {
            $this->attributes['is_active'] = 'false';
        } else {
            $this->attributes['is_active'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
        }
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

}
