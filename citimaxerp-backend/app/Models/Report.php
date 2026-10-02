<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Str;

class Report extends Model
{
    use HasFactory, HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'type',
        'module',
        'filters',
        'status',
        'last_generated_at',
        'created_by',
    ];

    protected $casts = [
        'filters' => 'array',
        'last_generated_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope for specific module
     */
    public function scopeForModule($query, $module)
    {
        return $query->where('module', $module);
    }

    /**
     * Scope for active reports
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
