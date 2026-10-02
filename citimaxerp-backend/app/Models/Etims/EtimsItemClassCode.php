<?php

namespace App\Models\Etims;

use Illuminate\Database\Eloquent\Model;

class EtimsItemClassCode extends Model
{
    protected $table = 'etims_item_class_codes';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['code', 'name', 'parent_code', 'level', 'is_leaf'];
    protected $casts = ['is_leaf' => 'boolean', 'level' => 'integer'];

    public function children()
    {
        return $this->hasMany(self::class, 'parent_code', 'code');
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_code', 'code');
    }
}
