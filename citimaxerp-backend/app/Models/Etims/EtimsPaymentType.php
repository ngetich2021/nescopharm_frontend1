<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;

class EtimsPaymentType extends Model
{
    protected $table = 'etims_payment_types';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code', 'name'];
}
