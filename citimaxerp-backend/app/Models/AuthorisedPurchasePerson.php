<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AuthorisedPurchasePerson extends Model
{
    protected $table = 'authorised_purchase_persons';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'customer_account_id',
        'name',
        'phone_number',
        'company_id',
        'created_by',
         ];
    public function customerAccount()
    {
        return $this->belongsTo(CustomerAccount::class);
    }
}
