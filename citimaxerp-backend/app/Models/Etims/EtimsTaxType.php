<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;

class EtimsTaxType extends Model
{
    protected $table = 'etims_tax_types';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code', 'name', 'rate', 'description'];
    protected $casts = ['rate' => 'decimal:4'];
}
