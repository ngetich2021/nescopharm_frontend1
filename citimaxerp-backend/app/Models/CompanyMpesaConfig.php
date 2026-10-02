<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyMpesaConfig extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'paybill_number',
        'till_number',
        'shortcode',
        'consumer_key',
        'consumer_secret',
        'passkey',
        'callback_url',
        'confirmation_url',
        'validation_url',
        'environment', // sandbox, production
        'is_active',
        'description',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

}
