<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Breakage extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'breakages';

    protected $fillable = [
        'id',
        'company_id',
        'reported_by',
        'breakage_number',
        'notes',
        'approval_status',
        'approved_by',
        'status', // e.g., 'pending', 'approved', 'rejected', 'replaced', etc.
    ];

      // Ensure proper casting for PostgreSQL dates
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];


    public function items()
    {
        return $this->hasMany(BreakageItem::class, 'breakage_id');
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Always return the short breakage number when accessing breakage_number
     */
    public function getBreakageNumberAttribute($value)
    {
        // If breakage_number is like BRK-853b296e-0074, return BRK-0074
        if (preg_match('/^(BRK)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

}
