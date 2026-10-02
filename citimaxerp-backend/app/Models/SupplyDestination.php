<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class SupplyDestination extends Model
{
    protected $table = 'supply_destinations';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'customer_account_id',
        'destination_name',
    ];
    public function customerAccount()
    {
        return $this->belongsTo(CustomerAccount::class);
    }
}
