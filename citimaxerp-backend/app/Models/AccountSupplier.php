<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AccountSupplier extends Model
{
    protected $table = 'account_suppliers';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'customer_account_id',
        'company_id',
        'created_by',
        'name',
        'contact_person_name',
        'phone_number',
        'credit_limit',
    ];
    public function customerAccount()
    {
        return $this->belongsTo(CustomerAccount::class);
    }
}
