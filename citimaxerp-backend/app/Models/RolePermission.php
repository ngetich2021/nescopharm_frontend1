<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class RolePermission extends Pivot
{
    protected $table = 'role_permissions';
    
    protected $fillable = [
        'role_id',
        'permission_id',
        'granted_by',
        'granted_at',
    ];

    protected $casts = [
        'role_id' => 'string',
        'permission_id' => 'string',
        'granted_by' => 'string',
        'granted_at' => 'datetime',
    ];

    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id', 'id');
    }

    public function permission()
    {
        return $this->belongsTo(Permission::class, 'permission_id', 'id');
    }

    public function grantedBy()
    {
        return $this->belongsTo(User::class, 'granted_by', 'id');
    }
}
