<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuoteNote extends Model
{
    use HasFactory;

    protected $table = 'quote_notes';
    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'id',
        'quote_id',
        'note_content',
        'created_by',
        'company_id',
    ];

    protected $casts = [
        'id' => 'string',
        'quote_id' => 'string',
        'company_id' => 'string',
        'created_by' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}