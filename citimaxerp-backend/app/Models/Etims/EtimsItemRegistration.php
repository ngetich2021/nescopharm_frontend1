<?php

namespace App\Models\Etims;

use App\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EtimsItemRegistration extends Model
{
    protected $table = 'etims_item_registrations';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'company_id', 'product_id', 'digitax_item_id',
        'item_code', 'item_class_code', 'item_type_code',
        'packaging_unit_code', 'quantity_unit_code',
        'country_of_origin_code', 'tax_type_code',
        'default_unit_price',
        'sync_status', 'client_request_id', 'last_error',
        'last_attempt_at', 'synced_at', 'attempts',
    ];

    protected $casts = [
        'last_attempt_at' => 'datetime',
        'synced_at' => 'datetime',
        'attempts' => 'integer',
        'default_unit_price' => 'decimal:2',
    ];

    public const STATUS_PENDING = 'pending';

    public const STATUS_SYNCED = 'synced';

    public const STATUS_FAILED = 'failed';

    protected static function booted(): void
    {
        static::creating(function (self $m) {
            if (empty($m->id)) {
                $m->id = (string) Str::uuid();
            }
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function isSynced(): bool
    {
        return $this->sync_status === self::STATUS_SYNCED;
    }
}
