<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AccountDirector extends Model
{
    protected $table = 'account_directors';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'customer_account_id',
        'company_id',
        'created_by',
        'name',
        'id_passport_number',
        'pin',
        'phone_number',
    ];
    public function customerAccount()
    {
        return $this->belongsTo(CustomerAccount::class);
    }
}
