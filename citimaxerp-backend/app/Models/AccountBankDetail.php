<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AccountBankDetail extends Model
{
    protected $table = 'account_bank_details';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'customer_account_id',
        'company_id',
        'created_by',
        'bank_name',
        'branch',
        'account_number',
    ];
    public function customerAccount()
    {
        return $this->belongsTo(CustomerAccount::class);
    }
}
