<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;

class EtimsQuantityUnit extends Model
{
    protected $table = 'etims_quantity_units';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code', 'name'];
}
