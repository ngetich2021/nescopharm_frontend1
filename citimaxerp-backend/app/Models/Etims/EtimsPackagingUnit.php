<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;

class EtimsPackagingUnit extends Model
{
    protected $table = 'etims_packaging_units';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code', 'name'];
}
