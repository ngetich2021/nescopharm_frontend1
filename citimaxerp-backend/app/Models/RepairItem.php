<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use Illuminate\Support\Str;

class RepairItem extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'repair_id',
        'product_id',
        'product_variant',
        'unique_identifier',
        'quantity',
        'is_repairable',
        'repaired',
        'status',
        'notes',
        'repaired_by',
        'repaired_at',
        'repair_notes',
        'assigned_to',
    ];


    protected $casts = [
        'is_repairable' => 'boolean',
        'repaired' => 'boolean',
        'repaired_at' => 'datetime',
    ];

    // Status helpers
    public function isPending() { return $this->status === 'pending'; }
    public function isInProgress() { return $this->status === 'in_progress'; }
    public function isRepaired() { return $this->status === 'repaired'; }
    public function isCompleted() { return $this->status === 'completed'; }



    public function repair()
    {
        return $this->belongsTo(Repair::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant');
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

}