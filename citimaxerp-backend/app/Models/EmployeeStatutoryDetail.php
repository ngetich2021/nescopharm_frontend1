<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class EmployeeStatutoryDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'kra_pin',
        'nssf_number',
        'shif_number',
        'tax_relief_status',
        'number_of_dependents',
        'disability_exemption_certificate',
        'disability_exemption_amount',
    ];

    protected $casts = [
        'disability_exemption_amount' => 'decimal:2',
        'number_of_dependents' => 'integer',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function isCompliant()
    {
        return !empty($this->kra_pin) && 
               !empty($this->nssf_number) && 
               !empty($this->shif_number);
    }
}