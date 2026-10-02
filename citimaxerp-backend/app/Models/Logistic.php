<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Logistic extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'order_dispatch_id',
        'company_id',
        'delivery_rate_id',
        'number_of_cartons',
        'delivery_invoice_id',
        'delivery_person_id',
        'driver_name',
        'driver_contact',
        'vehicle_registration',
        'vehicle_type',
        'logistics_provider',
        'delivery_cost',
        'amount_paid',
        'payment_method',
        'payment_status',
        'payment_reference',
        'payment_date',
        'cheque_number',
        'bank_name',
        'cheque_maturity_date',
        'delivery_method',
        'vehicle_id',
        'tracking_number',
        'transporter_invoice_number',
        'delivery_status',
        'recipient_name',
        'recipient_phone',
        'delivery_address',
        'city',
        'state',
        'region',
        'country',
        'dispatch_time',
        'actual_delivery_time',
        'signature',
        'estimated_delivery_time',
        'pickup_location',
        'delivery_location',
        'notes',
        'status', // Internal status
        'delivery_note_file',
        'delivery_note_uploaded_at',
        'delivery_note_uploaded_by',
        'delivery_note_status',
        'delivery_note_reviewed_by',
        'delivery_note_reviewed_at',
        'delivery_note_review_comment',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'estimated_delivery_time' => 'datetime',
        'dispatch_time' => 'datetime',
        'actual_delivery_time' => 'datetime',
        'payment_date' => 'date',
        'cheque_maturity_date' => 'date',
        'delivery_cost' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'delivery_note_uploaded_at' => 'datetime',
        'delivery_note_reviewed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['delivery_note_url'];

    /**
     * URL for the client-stamped delivery note photo, if one has been
     * uploaded. Written to the app's default disk (see
     * LogisticController::uploadDeliveryNote()) - a private disk (e.g. s3)
     * needs a signed, time-limited URL; a public one just needs its plain URL.
     */
    public function getDeliveryNoteUrlAttribute(): ?string
    {
        if (!$this->delivery_note_file) {
            return null;
        }

        $disk = config('filesystems.default');

        try {
            return Storage::disk($disk)->temporaryUrl(
                $this->delivery_note_file,
                now()->addHours(24)
            );
        } catch (\Exception $e) {
            return Storage::disk($disk)->url($this->delivery_note_file);
        }
    }

    public function orderDispatch()
    {
        return $this->belongsTo(OrderDispatch::class);
    }

    public function deliveryPerson()
    {
        return $this->belongsTo(DeliveryPerson::class);
    }

    public function deliveryNoteUploadedBy()
    {
        return $this->belongsTo(User::class, 'delivery_note_uploaded_by');
    }

    public function deliveryNoteReviewedBy()
    {
        return $this->belongsTo(User::class, 'delivery_note_reviewed_by');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function deliveryRate()
    {
        return $this->belongsTo(DeliveryRate::class);
    }

    public function deliveryInvoice()
    {
        return $this->belongsTo(DeliveryInvoice::class);
    }
}