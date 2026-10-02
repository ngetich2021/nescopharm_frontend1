<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BreakageItemDispatch extends Model
{
    protected $table = 'breakage_item_dispatch';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'breakage_item_id',
        'dispatch_id',
        'replaced_by',
        'replaced_at',
        'notes',
        'created_at',
        'updated_at',
    ];

    public function breakageItem()
    {
        return $this->belongsTo(BreakageItem::class, 'breakage_item_id');
    }

    public function dispatch()
    {
        return $this->belongsTo(Dispatch::class, 'dispatch_id');
    }

    public function replacer()
    {
        return $this->belongsTo(User::class, 'replaced_by');
    }
}
