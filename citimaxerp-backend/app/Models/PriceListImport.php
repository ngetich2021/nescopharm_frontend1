<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PriceListImport extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'company_id',
        'list_name',
        'version',
        'file_name',
        'file_path',
        'rows_count',
        'products_created',
        'products_matched',
        'prices_added',
        'prices_updated',
        'errors_count',
        'uploaded_by',
    ];

    protected $casts = [
        'version' => 'integer',
        'rows_count' => 'integer',
        'products_created' => 'integer',
        'products_matched' => 'integer',
        'prices_added' => 'integer',
        'prices_updated' => 'integer',
        'errors_count' => 'integer',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function getLabelAttribute(): string
    {
        return $this->list_name . $this->version;
    }
}
