<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PayrollConfiguration extends Model
{
    use HasFactory;

    protected $fillable = [
        'effective_from',
        'effective_to',
        'tax_bands',
        'nssf_tiers',
        'shif_rates',
        'minimum_wages',
        'overtime_rates',
        'personal_relief',
    ];

    protected $casts = [
        'tax_bands' => 'array',
        'nssf_tiers' => 'array',
        'shif_rates' => 'array',
        'minimum_wages' => 'array',
        'overtime_rates' => 'array',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'personal_relief' => 'decimal:2',
    ];

    public static function getCurrentConfig()
    {
        return static::where('effective_from', '<=', now())
            ->where(function ($query) {
                $query->where('effective_to', '>=', now())
                      ->orWhereNull('effective_to');
            })
            ->latest('effective_from')
            ->first();
    }
}