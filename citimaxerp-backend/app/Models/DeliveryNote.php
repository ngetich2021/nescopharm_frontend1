<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DeliveryNote extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'company_id',
        'order_dispatch_id',
        'note_number',
        'status',
        'items',
        'special_instructions',
        'generated_by',
        'finalized_at',
        'completed_at',
    ];

    protected $casts = [
        'items' => 'array',
        'finalized_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function orderDispatch()
    {
        return $this->belongsTo(OrderDispatch::class);
    }

    public function generatedBy()
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function finalize()
    {
        $this->update([
            'status' => 'finalized',
            'finalized_at' => now(),
        ]);
    }

    public function markCompleted()
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Generate delivery note number
     */
    public static function generateNumber($companyId)
    {
        $lastNote = self::where('company_id', $companyId)
            ->latest('created_at')
            ->first();

        $nextNumber = $lastNote ? (int) substr($lastNote->note_number, 3) + 1 : 1;
        return 'DN-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
    }
}
