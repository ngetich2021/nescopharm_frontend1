<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** One of the two people who must approve a credit note before it is credited, with their comment. */
class CreditNoteApproval extends Model
{
    use HasUuids;

    protected $fillable = ['credit_note_id', 'approver_id', 'position', 'status', 'comment', 'decided_at'];

    protected $casts = ['decided_at' => 'datetime', 'position' => 'integer'];

    public function creditNote()
    {
        return $this->belongsTo(CreditNote::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id')->select(['id', 'first_name', 'last_name', 'email']);
    }
}
