<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class JournalEntry extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'entry_number',
        'entry_date',
        'reference',
        'description',
        'total_debit',
        'total_credit',
        'status',
        'entry_type',
        'source_id',
        'source_type',
        'created_by',
        'posted_by',
        'posted_at',
        'reversed_by',
        'reversed_at',
        'reversal_reason',
        'metadata',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'total_debit' => 'decimal:2',
        'total_credit' => 'decimal:2',
        'posted_at' => 'datetime',
        'reversed_at' => 'datetime',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function items()
    {
        return $this->hasMany(JournalEntryItem::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function postedBy()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function reversedBy()
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }

    // Helper methods
    public function isBalanced()
    {
        return abs($this->total_debit - $this->total_credit) < 0.01;
    }

    public function post()
    {
        if ($this->status === 'posted') {
            throw new \Exception('Journal entry is already posted');
        }

        if (!$this->isBalanced()) {
            throw new \Exception('Journal entry is not balanced');
        }

        $this->update([
            'status' => 'posted',
            'posted_by' => auth()->id(),
            'posted_at' => now(),
        ]);
    }

    public function reverse($reason = null)
    {
        if ($this->status !== 'posted') {
            throw new \Exception('Only posted entries can be reversed');
        }

        $this->update([
            'status' => 'reversed',
            'reversed_by' => auth()->id(),
            'reversed_at' => now(),
            'reversal_reason' => $reason,
        ]);
    }

    /**
     * Statuses whose lines count toward balances. A reversed entry stays in the
     * books alongside its (posted) reversing entry; the two net to zero.
     * Counting only "posted" would keep the reversal but drop the original.
     */
    public const LEDGER_STATUSES = ['posted', 'reversed'];

    /** Documents whose number can change after posting, and the column holding it. */
    protected const NUMBERED_SOURCES = [
        \App\Models\Invoice::class => 'invoice_number',
        \App\Models\CreditNote::class => 'credit_note_number',
    ];

    /**
     * An invoice given its File No after it was posted (INV-0148 -> NSK/0427), or a credit note renumbered, keeps
     * its old number in its entries' reference and descriptions, since a re-sync only
     * compares amounts. Returns fn(JournalEntry, ?string): ?string that swaps the old
     * number for the document's current one, for display; the entries are not changed.
     */
    public static function currentNumberRewriter(iterable $entries): \Closure
    {
        $renames = []; // source id => [old number => current number]
        foreach (self::NUMBERED_SOURCES as $class => $column) {
            $ids = collect($entries)->where('source_type', $class)->pluck('source_id')->filter()->unique()->values();
            if ($ids->isEmpty()) {
                continue;
            }
            // Whole models: the printed number can depend on other columns (an invoice's File No).
            $current = $class::whereIn('id', $ids)->get()->mapWithKeys(fn ($doc) => [$doc->getKey() => $doc->{$column}]);
            // The numbers each document was posted under (its reversals carry REV- references).
            self::where('source_type', $class)->whereIn('source_id', $ids)
                ->where('reference', 'not like', 'REV-%')
                ->get(['source_id', 'reference'])
                ->each(function ($e) use ($current, &$renames) {
                    $now = $current[$e->source_id] ?? null;
                    if ($now && $e->reference && $e->reference !== $now) {
                        $renames[$e->source_id][$e->reference] = $now;
                    }
                });
        }

        return static function (self $entry, ?string $text) use ($renames): ?string {
            if ($text === null || empty($renames[$entry->source_id])) {
                return $text;
            }
            foreach ($renames[$entry->source_id] as $old => $now) {
                // Whole numbers only: INV-0014 must not touch INV-00145.
                $text = preg_replace('/(?<![A-Za-z0-9])' . preg_quote($old, '/') . '(?![A-Za-z0-9])/', $now, $text);
            }
            return $text;
        };
    }

    /**
     * Same, applied to the loaded entries (and their loaded lines) for a response. Display
     * only: the entries must not be saved afterwards.
     */
    public static function withCurrentNumbers(iterable $entries): iterable
    {
        $rewrite = self::currentNumberRewriter($entries);
        foreach ($entries as $entry) {
            $entry->reference = $rewrite($entry, $entry->reference);
            $entry->description = $rewrite($entry, $entry->description);
            if ($entry->relationLoaded('items')) {
                foreach ($entry->items as $item) {
                    $item->description = $rewrite($entry, $item->description);
                }
            }
        }
        return $entries;
    }

    // Scopes
    public function scopePosted($query)
    {
        return $query->where('status', 'posted');
    }

    public function scopeInLedger($query)
    {
        return $query->whereIn('status', self::LEDGER_STATUSES);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('entry_date', [$startDate, $endDate]);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('entry_type', $type);
    }
}
