<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Cheque extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'direction',
        'customer_id',
        'supplier_id',
        'payee_name',
        'invoice_id',
        'purchase_order_id',
        'payment_id',
        'supplier_payment_id',
        'cheque_number',
        'bank_name',
        'amount',
        'issue_date',
        'maturity_date',
        'status',
        'notes',
        'attachment_path',
        'created_by',
        'approved_by',
        'approved_at',
        'reminder_sent_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'issue_date' => 'date',
        'maturity_date' => 'date',
        'approved_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['attachment_url', 'payee_display_name'];

    /**
     * Who an issued cheque is actually paying - the linked supplier or
     * customer if there is one, otherwise the free-text payee (office
     * supplies vendor, logistics company, etc. with no master record).
     */
    public function getPayeeDisplayNameAttribute(): ?string
    {
        return $this->supplier?->name ?? $this->customer?->name ?? $this->payee_name;
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }

        $disk = config('filesystems.default', 's3');

        // Cloud storage (S3/R2) requires a signed, time-limited URL since the
        // bucket is not publicly readable — mirrors ProductImageService::getUrl().
        if ($disk === 's3' || config("filesystems.disks.{$disk}.driver") === 's3') {
            try {
                return Storage::disk($disk)->temporaryUrl(
                    $this->attachment_path,
                    now()->addHours(24)
                );
            } catch (\Exception $e) {
                return Storage::disk($disk)->url($this->attachment_path);
            }
        }

        return Storage::disk($disk)->url($this->attachment_path);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function scopeReceived($query)
    {
        return $query->where('direction', 'received');
    }

    public function scopeIssued($query)
    {
        return $query->where('direction', 'issued');
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    public function supplierPayment()
    {
        return $this->belongsTo(SupplierPayment::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
