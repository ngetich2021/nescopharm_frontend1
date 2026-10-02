<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Facades\Log;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, HasUuids, SoftDeletes;

    protected $table = 'users';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'avatar_url',
        'is_active',
        'email_verified',
        'last_login_at',
        'role_id',
        'password_setup_token',
        'password_setup_token_expires_at',
        'frontend_url',
        'terminated_at',
        'termination_reason',
        'terminated_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'password_setup_token',
        'password_setup_token_expires_at',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'role_id' => 'string',
        'terminated_by' => 'string',
        'is_active' => 'boolean',
        'email_verified' => 'boolean',
        'last_login_at' => 'datetime',
        'terminated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'password_setup_token_expires_at' => 'datetime',
    ];

    protected $appends = ['full_name'];

    protected static function booted()
    {
        // Prevent email reuse even after soft-delete/termination.
        // This is a defense-in-depth guard in addition to the DB unique
        // constraint and controller validation. It ensures direct
        // User::create / Eloquent usage cannot bypass the rule.
        static::saving(function ($user) {
            if ($user->isDirty('email') && !empty($user->email)) {
                $exists = static::withTrashed()
                    ->where('email', $user->email)
                    ->when($user->exists, function ($q) use ($user) {
                        $q->where('id', '!=', $user->id);
                    })
                    ->exists();
                if ($exists) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'email' => 'This email is already taken, including by a deactivated or terminated account. Use a different email or restore the deleted account.',
                    ]);
                }
            }
        });

        static::created(function ($user) {
            // Skip if no company_id
            if (!$user->company_id) {
                Log::warning('User created without company_id, skipping role assignment', ['user_id' => $user->id]);
                return;
            }

            // Skip if user already has a role
            if ($user->role_id) {
                Log::info('User already has a role, skipping role creation', ['user_id' => $user->id, 'role_id' => $user->role_id]);
                return;
            }

            // Verify company exists
            if (!Company::where('id', $user->company_id)->exists()) {
                Log::error('Company does not exist for user, skipping role assignment', ['user_id' => $user->id, 'company_id' => $user->company_id]);
                return;
            }

            // Check if this is the first user for the company
            try {
                $isFirstUser = !User::where('company_id', $user->company_id)
                    ->where('id', '!=', $user->id)
                    ->exists();

                if (!$isFirstUser) {
                    Log::info('User is not the first for the company, skipping super_admin role assignment', ['user_id' => $user->id, 'company_id' => $user->company_id]);
                    return;
                }

                // Create or assign super_admin role
                $role = Role::where('company_id', $user->company_id)
                    ->where('name', 'super_admin')
                    ->first();

                if (!$role) {
                    $permissions = [
                        'can_view_chat' => true,
                        'can_edit_orders' => true,
                        'can_edit_quotes' => true,
                        'can_manage_chat' => true,
                        'can_view_orders' => true,
                        'can_view_quotes' => true,
                        'can_view_stores' => true,
                        'can_view_reports' => true,
                        'can_create_orders' => true,
                        'can_create_quotes' => true,
                        'can_delete_orders' => true,
                        'can_delete_quotes' => true,
                        'can_edit_expenses' => true,
                        'can_edit_invoices' => true,
                        'can_edit_products' => true,
                        'can_manage_stores' => true,
                        'can_view_expenses' => true,
                        'can_view_invoices' => true,
                        'can_view_payments' => true,
                        'can_view_products' => true,
                        'can_view_settings' => true,
                        'can_edit_customers' => true,
                        'can_manage_pricing' => true,
                        'can_manage_profile' => true,
                        'can_view_customers' => true,
                        'can_view_dashboard' => true,
                        'can_view_logistics' => true,
                        'can_create_expenses' => true,
                        'can_create_invoices' => true,
                        'can_create_products' => true,
                        'can_delete_expenses' => true,
                        'can_delete_invoices' => true,
                        'can_delete_products' => true,
                        'can_manage_payments' => true,
                        'can_create_customers' => true,
                        'can_delete_customers' => true,
                        'can_manage_all_users' => true,
                        'can_manage_companies' => true,
                        'can_manage_logistics' => true,
                        'can_edit_stock_counts' => true,
                        'can_view_stock_counts' => true,
                        'can_access_admin_portal' => true,
                        'can_create_stock_counts' => true,
                        'can_delete_stock_counts' => true,
                        'can_manage_all_expenses' => true,
                        'can_view_sales_overview' => true,
                        'can_manage_subscriptions' => true,
                        'can_manage_users_and_roles' => true,
                        'can_manage_company_settings' => true,
                        'can_view_inventory_overview' => true,
                        'can_manage_all_delivery_persons' => true,
                        'can_manage_features_and_permissions' => true,
                        'can_manage_subscriptions_and_payments' => true,
                    ];

                    $role = Role::create([
                        'id' => \Illuminate\Support\Str::uuid(),
                        'company_id' => $user->company_id,
                        'name' => 'super_admin',
                        'description' => 'Super Admin role with full privileges',
                        'permissions' => $permissions,
                        'is_active' => true,
                    ]);
                    Log::info('Created super_admin role', ['role_id' => $role->id, 'company_id' => $user->company_id]);
                } else {
                    Log::info('Found existing super_admin role', ['role_id' => $role->id, 'company_id' => $user->company_id]);
                }

                // Assign the role to the user
                $user->forceFill(['role_id' => $role->id])->save();
                Log::info('Assigned super_admin role to user', ['user_id' => $user->id, 'role_id' => $role->id]);
            } catch (\Exception $e) {
                Log::error('Failed to assign super_admin role to user', [
                    'user_id' => $user->id,
                    'company_id' => $user->company_id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                throw $e;
            }
        });
    }

    public function terminatedByUser()
    {
        return $this->belongsTo(User::class, 'terminated_by', 'id');
    }

    public function isTerminated(): bool
    {
        return !is_null($this->terminated_at);
    }

    public function isSoftDeleted(): bool
    {
        return !is_null($this->deleted_at) && is_null($this->terminated_at);
    }

    /**
     * Terminate user account: soft-delete + revoke tokens + mark terminated
     */
    public function terminate(?string $reason = null, ?string $terminatedBy = null): bool
    {
        $this->forceFill([
            'is_active' => false,
            'terminated_at' => now(),
            'termination_reason' => $reason,
            'terminated_by' => $terminatedBy,
        ])->save();
        // Revoke all tokens
        $this->tokens()->delete();
        // Soft delete
        return $this->delete();
    }

    public function restoreAccount(): bool
    {
        $restored = $this->restore();
        if ($restored) {
            $this->forceFill([
                'terminated_at' => null,
                'termination_reason' => null,
                'terminated_by' => null,
            ])->save();
        }
        return $restored;
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id', 'id');
    }

    public function assignedConversations()
    {
        return $this->hasMany(Conversation::class, 'assigned_agent_id');
    }

    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function createdTemplates()
    {
        return $this->hasMany(MessageTemplate::class, 'created_by');
    }

    public function hasVerifiedEmail()
    {
        return $this->email_verified;
    }

    public function markEmailAsVerified()
    {
        return $this->forceFill([
            'email_verified' => true,
        ])->save();
    }


    // Boolean mutators for PostgreSQL compatibility (store as 'true'/'false' strings)
    public function setIsActiveAttribute($value)
    {
        if ($value === null) {
            $this->attributes['is_active'] = 'true';
        } else {
            $this->attributes['is_active'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
        }
    }

    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    public function setEmailVerifiedAttribute($value)
    {
        if ($value === null) {
            $this->attributes['email_verified'] = 'false';
        } else {
            $this->attributes['email_verified'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
        }
    }

    public function getEmailVerifiedAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    /**
     * Get the user's full name
     */
    public function getFullNameAttribute()
    {
        return trim($this->first_name . ' ' . $this->last_name);
    }

}
