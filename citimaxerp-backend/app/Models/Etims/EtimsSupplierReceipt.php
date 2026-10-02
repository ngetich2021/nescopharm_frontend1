<?php

namespace App\Models\Etims;

use App\Models\Supplier;
use App\Models\AccountsPayable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EtimsSupplierReceipt extends Model
{
    protected $table = 'etims_supplier_receipts';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'company_id', 'supplier_bill_id', 'supplier_id', 'uploaded_by',
        'upload_path', 'upload_mime',
        'supplier_kra_pin', 'trader_invoice_number', 'qr_payload', 'etims_signature',
        'invoice_date', 'total_amount', 'tax_amount', 'currency',
        'verification_status', 'verification_error', 'verified_at', 'vat_reclaimable',
        'digitax_verify_payload',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'verified_at' => 'datetime',
        'total_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'vat_reclaimable' => 'boolean',
        'digitax_verify_payload' => 'array',
    ];

    public const PENDING = 'pending';
    public const VERIFIED = 'verified';
    public const INVALID = 'invalid';
    public const ERROR = 'error';

    protected static function booted(): void
    {
        static::creating(function (self $m) {
            if (empty($m->id)) {
                $m->id = (string) Str::uuid();
            }
        });
    }

    public function supplierBill()
    {
        return $this->belongsTo(AccountsPayable::class, 'supplier_bill_id');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }
}
