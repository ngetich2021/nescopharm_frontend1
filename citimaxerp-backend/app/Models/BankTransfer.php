<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Money moved between two of the company's own money accounts (e.g. a withdrawal from Prime
 * Bank into cash to pay wages), with any bank charge. Posts to the ledger via LedgerSyncObserver:
 * DR to-account (amount), DR Bank Charges (charges), CR from-account (amount + charges).
 */
class BankTransfer extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'transfer_number', 'transfer_date', 'from_account_id', 'to_account_id',
        'amount', 'charges', 'reference', 'purpose', 'notes', 'created_by',
    ];

    protected $casts = [
        'transfer_date' => 'date',
        'amount' => 'decimal:2',
        'charges' => 'decimal:2',
    ];

    /**
     * Record a transfer under the next TRF-0001, TRF-0002 ... number of its company. The lock keeps
     * two saves from taking the same number.
     */
    public static function record(array $attributes): self
    {
        return \Illuminate\Support\Facades\DB::transaction(function () use ($attributes) {
            $last = static::where('company_id', $attributes['company_id'])->lockForUpdate()
                ->orderByDesc('transfer_number')->value('transfer_number');
            $next = $last ? ((int) substr($last, 4)) + 1 : 1;

            return static::create($attributes + ['transfer_number' => 'TRF-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT)]);
        });
    }

    public function fromAccount()
    {
        return $this->belongsTo(ChartOfAccount::class, 'from_account_id');
    }

    public function toAccount()
    {
        return $this->belongsTo(ChartOfAccount::class, 'to_account_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
