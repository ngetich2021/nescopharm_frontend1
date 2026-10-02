<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class OrderDispatch extends Model
{
    use HasFactory;

    protected $table = 'order_dispatches';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'dispatch_number',
        'order_id',
        'company_id',
        'from_store_id',
        'delivery_location_id',
        'approvers',
        'approval_status',
        'logistic_id',
        'status',
        'dispatch_date',
        'estimated_delivery_date',
        'actual_delivery_date',
        'notes',
        'special_instructions',
        'created_by',
        'final_approved_at',
    ];

    protected $casts = [
        'approvers' => 'array',
        'dispatch_date' => 'datetime',
        'estimated_delivery_date' => 'datetime',
        'actual_delivery_date' => 'datetime',
        'final_approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Boot the model
     */
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            
            // Auto-generate dispatch number if not set
            if (empty($model->dispatch_number) && !empty($model->company_id)) {
                $prefix = 'ODI-' . substr($model->company_id, 0, 8) . '-';
                
                $lastDispatch = static::where('dispatch_number', 'like', $prefix . '%')
                    ->orderBy('dispatch_number', 'desc')
                    ->lockForUpdate()
                    ->first();

                $nextNumber = $lastDispatch ? (int)substr($lastDispatch->dispatch_number, strlen($prefix)) + 1 : 1;
                $model->dispatch_number = $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    /**
     * Initialize default approvers from company settings
     */
    public function initializeDefaultApprovers()
    {
        if (!$this->company) {
            return;
        }

        $settings = CompanySetting::getDispatchApprovalSettings($this->company_id);
        
        if (empty($settings['default_approvers'])) {
            return;
        }

        // Filter out inactive/deleted users
        $activeApprovers = collect($settings['default_approvers'])
            ->map(function ($approver) {
                $user = User::find($approver['user_id']);
                
                // Skip if user doesn't exist or is inactive
                if (!$user || !$user->is_active) {
                    return null;
                }
                
                return [
                    'user_id' => $approver['user_id'],
                    'order' => $approver['order'],
                    'status' => 'pending',
                    'approved_at' => null,
                    'comments' => null,
                ];
            })
            ->filter()
            ->values()
            ->toArray();

        // Re-order after filtering
        $activeApprovers = collect($activeApprovers)
            ->sortBy('order')
            ->values()
            ->map(function ($approver, $index) {
                $approver['order'] = $index + 1;
                return $approver;
            })
            ->toArray();

        $this->approvers = $activeApprovers;
    }

    /**
     * Get current pending approver
     */
    public function getCurrentApprover()
    {
        if (empty($this->approvers)) {
            return null;
        }

        $pending = collect($this->approvers)
            ->where('status', 'pending')
            ->sortBy('order')
            ->first();

        if (!$pending) {
            return null;
        }

        return User::find($pending['user_id']);
    }

    /**
     * Check if user can approve this dispatch
     */
    public function canBeApprovedBy(User $user)
    {
        $currentApprover = $this->getCurrentApprover();
        
        return $currentApprover && $currentApprover->id === $user->id;
    }

    /**
     * Approve by current user
     */
    public function approve(User $user, $comments = null)
    {
        if (!$this->canBeApprovedBy($user)) {
            throw new \Exception('You are not the current approver for this dispatch.');
        }

        // Update only the FIRST pending approver's status (to handle same user multiple times)
        $approvers = $this->approvers;
        $updated = false;
        
        foreach ($approvers as &$approver) {
            if (!$updated && $approver['user_id'] === $user->id && $approver['status'] === 'pending') {
                $approver['status'] = 'approved';
                $approver['approved_at'] = now()->toDateTimeString();
                $approver['comments'] = $comments;
                $updated = true;
                break;
            }
        }
        
        $this->approvers = $approvers;

        // Check if all approvers have approved
        $allApproved = collect($approvers)->every(function ($approver) {
            return $approver['status'] === 'approved';
        });

        if ($allApproved) {
            $this->approval_status = 'approved';
            $this->status = 'approved';
            $this->final_approved_at = now();
        } else {
            $this->approval_status = 'in_progress';
        }

        $this->save();

        return $this;
    }

    /**
     * Reject dispatch
     */
    public function reject(User $user, $reason)
    {
        if (!$this->canBeApprovedBy($user)) {
            throw new \Exception('You are not the current approver for this dispatch.');
        }

        // Update the approver's status
        $approvers = collect($this->approvers)->map(function ($approver) use ($user, $reason) {
            if ($approver['user_id'] === $user->id && $approver['status'] === 'pending') {
                $approver['status'] = 'rejected';
                $approver['approved_at'] = now()->toDateTimeString();
                $approver['comments'] = $reason;
            }
            return $approver;
        })->toArray();

        $this->approvers = $approvers;
        $this->approval_status = 'rejected';
        $this->status = 'cancelled';
        $this->save();

        return $this;
    }

    /**
     * Check if all approvers have approved
     */
    public function isFullyApproved()
    {
        if (empty($this->approvers)) {
            return false;
        }

        return collect($this->approvers)->every(function ($approver) {
            return $approver['status'] === 'approved';
        });
    }

    /**
     * Get approval progress
     */
    public function getApprovalProgress()
    {
        if (empty($this->approvers)) {
            return [
                'total' => 0,
                'approved' => 0,
                'pending' => 0,
                'percentage' => 0,
            ];
        }

        $total = count($this->approvers);
        $approved = collect($this->approvers)->where('status', 'approved')->count();
        
        return [
            'total' => $total,
            'approved' => $approved,
            'pending' => $total - $approved,
            'percentage' => $total > 0 ? round(($approved / $total) * 100) : 0,
        ];
    }

    /**
     * Get the short dispatch number (e.g., ODI-0001)
     */
    public function getDispatchNumberAttribute($value)
    {
        // If dispatch_number is like ODI-853b296e-0001, return ODI-0001
        if (preg_match('/^(ODI)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        return $value;
    }

    /**
     * Relationships
     */
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function fromStore()
    {
        return $this->belongsTo(Store::class, 'from_store_id');
    }

    public function deliveryLocation()
    {
        return $this->belongsTo(DeliveryLocation::class);
    }

    public function logistic()
    {
        return $this->belongsTo(Logistic::class);
    }

    public function items()
    {
        return $this->hasMany(OrderDispatchItem::class, 'order_dispatch_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /**
     * Get all approvers as user models
     */
    public function getApproversAttribute($value)
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return $value;
    }

    /**
     * Get approver users with their details
     */
    public function getApproverUsersAttribute()
    {
        if (empty($this->approvers)) {
            return collect([]);
        }

        return collect($this->approvers)->map(function ($approver) {
            $user = User::withTrashed()->find($approver['user_id']);
            return [
                'user' => $user,
                'order' => $approver['order'],
                'status' => $approver['status'],
                'approved_at' => $approver['approved_at'],
                'comments' => $approver['comments'],
            ];
        });
    }

    /**
     * Check if dispatch is approved
     */
    public function isApproved()
    {
        return $this->approval_status === 'approved';
    }

    /**
     * Check if dispatch is pending approval
     */
    public function isPendingApproval()
    {
        return in_array($this->approval_status, ['pending', 'in_progress']);
    }

    /**
     * Check if dispatch can be edited
     */
    public function canBeEdited()
    {
        return in_array($this->approval_status, ['draft', 'rejected']);
    }

    /**
     * Check if dispatch can be dispatched (logistics created)
     */
    public function canBeDispatched()
    {
        return $this->approval_status === 'approved' && $this->status === 'approved';
    }
}
