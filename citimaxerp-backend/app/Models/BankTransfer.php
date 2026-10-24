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
