<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A physical count of the petty cash against the books' balance on that date (difference = counted - system). */
class PettyCashCount extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'account_id', 'count_date', 'counted_amount', 'system_balance', 'difference',
        'denominations', 'notes', 'counted_by',
    ];

    protected $casts = [
        'count_date' => 'date',
        'counted_amount' => 'decimal:2',
        'system_balance' => 'decimal:2',
        'difference' => 'decimal:2',
        'denominations' => 'array',
    ];

    public function counter()
    {
        return $this->belongsTo(User::class, 'counted_by');
    }
}
