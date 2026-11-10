<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'email',
        'phone',
        'address',
        'contact_person',
        'notes',
        'is_active',
        'bank_name',
        'bank_account_number',
        'bank_branch',
        'bank_swift_code',
        'payment_terms_type',
        'payment_terms_days',
        'payment_terms_description',
        'tax_information',
        'credit_limit', // how much we may owe them; ordering past it warns, never blocks
    ];

    // Ensure proper casting for PostgreSQL booleans & integers
    protected $casts = [
        'is_active' => 'boolean',
        'payment_terms_days' => 'integer',
        'credit_limit' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Always return the short supplier code when accessing supplier_code
     */
    public function getSupplierCodeAttribute($value)
    {
        // If supplier_code is like SUP-853b296e-0074, return SUP-0074
        if (preg_match('/^(SUP)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Handle is_active boolean conversion for PostgreSQL
     */
    public function setIsActiveAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean
        if ($value === null) {
            $this->attributes['is_active'] = 'true'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_active'] = $value ? true : false;
        }
    }

    /**
     * Get is_active as boolean when retrieving
     */
    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    // Relationships
    public function purchases()
    {
        return $this->hasMany(PurchaseOrder::class, 'supplier_id', 'id');
    }

    public function returns()
    {
        return $this->hasMany(PurchaseOrderReturn::class, 'supplier_id', 'id');
    }

    /**
     * Credit used with this supplier against its credit limit: what we owe on its unpaid invoices
     * (debit notes already off), plus purchase orders not yet received (pending/approved), plus
     * $adding (an order being placed). $exceptOrderId leaves out an order being edited.
     * 'over' is how far past the limit it goes (0 when within it, or no limit set).
     */
    public function creditUse(float $adding = 0, ?string $exceptOrderId = null): array
    {
        $owed = (float) \Illuminate\Support\Facades\DB::table('accounts_payable')->where('vendor_id', $this->id)
            ->whereRaw("coalesce(metadata::jsonb->>'kind', 'bill') = 'bill'")->where('balance_amount', '>', 0)->sum('balance_amount');
        $onOrder = (float) \Illuminate\Support\Facades\DB::table('purchase_orders')->where('supplier_id', $this->id)
            ->whereNotIn('status', ['received', 'cancelled', 'rejected', 'completed', 'closed'])
            ->when($exceptOrderId, fn ($q) => $q->where('id', '!=', $exceptOrderId))
            ->sum('total_amount');
        $limit = $this->credit_limit !== null ? (float) $this->credit_limit : null;
        $total = round($owed + $onOrder + $adding, 2);

        return [
            'limit' => $limit,
            'owed' => round($owed, 2),
            'on_order' => round($onOrder, 2),
            'adding' => round($adding, 2),
            'total' => $total,
            'over' => $limit !== null && $limit > 0 ? round(max(0, $total - $limit), 2) : 0.0,
        ];
    }

    /** The warning to show when ordering takes this supplier past its credit limit, else null. */
    public function creditWarning(array $use): ?string
    {
        if (($use['over'] ?? 0) <= 0) {
            return null;
        }
        $f = fn ($n) => number_format((float) $n, 2);

        return "{$this->name}: credit limit KES {$f($use['limit'])} exceeded by KES {$f($use['over'])} "
            . "(owed KES {$f($use['owed'])} + on order KES {$f($use['on_order'] + $use['adding'])}). The order is still placed.";
    }
}
