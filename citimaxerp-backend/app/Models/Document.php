<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    /**
     * Link document to a customer (if applicable)
     */
    public function customer()
    {
        return $this->belongsTo(Customer::class, 'documentable_id')->where('documentable_type', Customer::class);
    }
    protected $table = 'documents';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'document_name',
        'document_number',
        'reference_number',
        'expiry_date',
        'regulatory_body',
        'document_image',
        'documentable_type',
        'documentable_id',
        'company_id',
        'created_by',
        'other_information',
    ];

    public function documentable()
    {
        return $this->morphTo();
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
