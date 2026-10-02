<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Notifications\VerifyEmailNotification;
use App\Http\Traits\HandlesDatabaseErrors;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    use HandlesDatabaseErrors;

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * View user details (show)
     */
    public function show($id, Request $request)
    {
        $user = $request->user();
        $targetUser = User::with(['company', 'role'])->find($id);
        if (!$targetUser) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.'
            ], 404);
        }
        if (!$this->hasPermission($request, "can_view_users", $targetUser->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this user.'
            ], 403);
        }
        return response()->json([
            'status' => 'success',
            'user' => $targetUser
        ], 200);
    }

    /**
     * Update user details (edit) — supports roles & avatar, with company-scoped role validation
     */
    public function update(Request $request, $id)
    {
        $authUser = $request->user();
        $user = User::find($id);
        if (!$user) {
            // Also check trashed so restore can be discovered
            $user = User::withTrashed()->find($id);
            if (!$user) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'User not found.'
                ], 404);
            }
        }
        if (!$this->hasPermission($request, "can_update_users", $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this user.'
            ], 403);
        }
        // Prevent operations on terminated accounts unless restoring
        if ($user->trashed() && $request->input('action') !== 'restore') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot update a deleted/terminated account. Restore it first.'
            ], 400);
        }
        $validator = Validator::make($request->all(), [
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|nullable|string|max:50',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $user->id,
            'avatar_url' => 'sometimes|nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
            'email_verified' => 'sometimes|boolean',
            'role_id' => 'sometimes|nullable|uuid|exists:roles,id',
            'permission_ids' => 'sometimes|array',
            'permission_ids.*' => 'uuid|exists:permissions,id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }
        $data = $validator->validated();

        // Company-scoped role validation: role must belong to the user's company
        if (array_key_exists('role_id', $data) && !empty($data['role_id'])) {
            $roleBelongs = \App\Models\Role::where('id', $data['role_id'])
                ->where('company_id', $user->company_id)->exists();
            if (!$roleBelongs) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Role does not belong to this user\'s company.'
                ], 400);
            }
        }

        // Extract permission_ids for role assignment (not a column on users)
        $permissionIds = $data['permission_ids'] ?? null;
        unset($data['permission_ids']);

        // Normalize booleans for PostgreSQL
        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }
        if (isset($data['email_verified'])) {
            $data['email_verified'] = filter_var($data['email_verified'], FILTER_VALIDATE_BOOLEAN);
        }
        // Allow null role (unassign)
        if (array_key_exists('role_id', $data) && $data['role_id'] === '') {
            $data['role_id'] = null;
        }

        try {
            DB::beginTransaction();

            if (!empty($data)) {
                $user->update($data);
            }

            // If permission_ids provided, update the assigned role's permissions
            if ($permissionIds !== null) {
                $roleId = $data['role_id'] ?? $user->role_id;
                if (!$roleId) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Assign a role before assigning permissions.'
                    ], 400);
                }
                $role = \App\Models\Role::where('id', $roleId)->where('company_id', $user->company_id)->first();
                if (!$role) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Role not found for this company.'
                    ], 404);
                }
                // Validate permissions belong to system or this company
                $available = \App\Models\Permission::whereIn('id', $permissionIds)
                    ->where(function ($q) use ($user) {
                        $q->whereRaw('is_system = true')->orWhere('company_id', $user->company_id);
                    })->pluck('id')->toArray();
                $invalid = array_diff($permissionIds, $available);
                if (!empty($invalid)) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Some permissions are not available for this company.',
                        'invalid_permissions' => array_values($invalid)
                    ], 400);
                }
                // Sync permissions to role (replace existing with provided set)
                $role->permissions()->sync($permissionIds);
                foreach ($permissionIds as $pid) {
                    \DB::table('role_permissions')->where('role_id', $role->id)->where('permission_id', $pid)
                        ->update(['granted_by' => $authUser->id, 'granted_at' => now()]);
                }
            }

            DB::commit();
            $user->refresh();
            $user->load(['company', 'role.permissions']);

            return response()->json([
                'status' => 'success',
                'message' => 'User updated successfully.',
                'user' => $user
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Soft delete user (deactivate + soft delete)
     */
    public function softDelete($id, Request $request)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.'
            ], 404);
        }
        if (!$this->hasPermission($request, "can_delete_users", $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this user.'
            ], 403);
        }
        if ($user->id === $request->user()->id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You cannot delete your own account.'
            ], 400);
        }
        if ($user->trashed()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User is already deleted.'
            ], 400);
        }
        // Prevent deleting last super_admin in company
        if ($user->role && $user->role->name === 'super_admin') {
            $remaining = User::where('company_id', $user->company_id)
                ->where('id', '!=', $user->id)
                ->whereHas('role', fn($q) => $q->where('name', 'super_admin'))
                ->count();
            if ($remaining === 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete the last super admin for this company.'
                ], 400);
            }
        }
        $user->update(['is_active' => false]);
        $user->tokens()->delete();
        $user->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'User soft-deleted successfully. Use restore to recover.'
        ], 200);
    }

    /**
     * Terminate user account (permanent deactivation + soft delete with reason)
     */
    public function terminate($id, Request $request)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.'
            ], 404);
        }
        if (!$this->hasPermission($request, "can_delete_users", $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to terminate this user.'
            ], 403);
        }
        if ($user->id === $request->user()->id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You cannot terminate your own account.'
            ], 400);
        }
        if ($user->trashed()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User is already deleted/terminated.'
            ], 400);
        }
        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }
        if ($user->role && $user->role->name === 'super_admin') {
            $remaining = User::where('company_id', $user->company_id)
                ->where('id', '!=', $user->id)
                ->whereHas('role', fn($q) => $q->where('name', 'super_admin'))
                ->count();
            if ($remaining === 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot terminate the last super admin for this company.'
                ], 400);
            }
        }
        $user->terminate($request->input('reason'), $request->user()->id);
        return response()->json([
            'status' => 'success',
            'message' => 'User terminated successfully. Account is deactivated and tokens revoked.'
        ], 200);
    }

    /**
     * Restore a soft-deleted / terminated user
     */
    public function restore($id, Request $request)
    {
        $user = User::withTrashed()->find($id);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.'
            ], 404);
        }
        if (!$user->trashed()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User is not deleted.'
            ], 400);
        }
        if (!$this->hasPermission($request, "can_update_users", $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to restore this user.'
            ], 403);
        }
        $user->restoreAccount();
        $user->update(['is_active' => true]);
        return response()->json([
            'status' => 'success',
            'message' => 'User restored successfully.',
            'user' => $user->load(['company', 'role'])
        ], 200);
    }

    /**
     * Delete user by deactivating and soft-deleting the account.
     */
    public function destroy($id, Request $request)
    {
        $authUser = $request->user();
        $user = User::withTrashed()->find($id);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.'
            ], 404);
        }
        if (!$this->hasPermission($request, "can_delete_users", $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this user.'
            ], 403);
        }
        if ($user->id === $authUser->id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'You cannot delete your own account.'
            ], 400);
        }
        if ($user->trashed()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User is already deleted.'
            ], 400);
        }

        return $this->softDelete($id, $request);
    }

    /**
     * Reset password (send reset link to email)
     */
    public function sendPasswordResetLink(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }
        $user = User::where('email', $request->input('email'))->first();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.'
            ], 404);
        }
        // Generate a new password setup token
        $passwordSetupToken = Str::random(64);
        $passwordSetupTokenExpires = now()->addHours(24);
        $user->password_setup_token = $passwordSetupToken;
        $user->password_setup_token_expires_at = $passwordSetupTokenExpires;
        
        // Try to use the stored frontend URL, or detect from request
        $frontendUrl = $user->frontend_url ?? $request->header('Origin') ?? $request->header('Referer') ?? config('app.frontend_url', 'https://cherry360.africa');
        // Clean the URL to get just the base
        if (filter_var($frontendUrl, FILTER_VALIDATE_URL)) {
            $parsedUrl = parse_url($frontendUrl);
            $frontendUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
        }
        $frontendUrl = rtrim($frontendUrl, '/');
        
        $user->save();
        
        $passwordSetupUrl = $frontendUrl . "/set-password?token=$passwordSetupToken&id={$user->id}";
        Notification::send($user, new VerifyEmailNotification($passwordSetupUrl));
        return response()->json([
            'status' => 'success',
            'message' => 'Password reset link sent to email.'
        ], 200);
    }
    public function __construct()
    {
        $this->middleware('auth:sanctum')->except(['createNewUser', 'login', 'setPasswordAfterVerification']);
    }

    /**
     * Create a user within the logged-in user's company (internal, admin only)
     */
    public function createInternalUser(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|unique:users,email',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'nullable|string|max:50',
            'role_id' => 'nullable|uuid|exists:roles,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        $admin = $request->user();
        $companyId = $admin->company_id;

        // Permission check (optional, can be more granular)
        if (!$this->hasPermission($request, 'can_create_users', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create users.'
            ], 403);
        }

        // Explicit soft-delete aware email check (defense-in-depth).
        // The `unique:users,email` validator already counts soft-deleted rows via
        // the query builder, but this makes the intent explicit and provides a
        // clearer error when the DB unique constraint is the final guard.
        if (User::withTrashed()->where('email', $request->input('email'))->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => ['email' => ['This email is already taken, including by a deactivated or terminated account. Use a different email or restore the deleted account.']]
            ], 400);
        }

        DB::beginTransaction();
        try {
            $passwordSetupToken = Str::random(64);
            $passwordSetupTokenExpires = now()->addHours(24);

            // Ensure booleans are cast as proper PostgreSQL-compatible values
            $isActive = filter_var(true, FILTER_VALIDATE_BOOLEAN);
            $emailVerified = filter_var(false, FILTER_VALIDATE_BOOLEAN);

            // Detect frontend URL from the request
            $frontendUrl = $request->header('Origin') ?? $request->header('Referer') ?? config('app.frontend_url', 'https://cherry360.africa');
            // Clean the URL to get just the base
            if (filter_var($frontendUrl, FILTER_VALIDATE_URL)) {
                $parsedUrl = parse_url($frontendUrl);
                $frontendUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
            }
            $frontendUrl = rtrim($frontendUrl, '/');

            $user = User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'email' => $request->input('email'),
                'password' => null, // No password yet
                'first_name' => $request->input('first_name'),
                'last_name' => $request->input('last_name'),
                'phone' => $request->input('phone'),
                'is_active' => $isActive,
                'email_verified' => $emailVerified,
                'password_setup_token' => $passwordSetupToken,
                'password_setup_token_expires_at' => $passwordSetupTokenExpires,
                'frontend_url' => $frontendUrl,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $passwordSetupUrl = $frontendUrl . "/set-password?token=$passwordSetupToken&id={$user->id}";
            Notification::send($user, new VerifyEmailNotification($passwordSetupUrl));

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'User created successfully. Please verify your email and set your password.',
                'user' => $user,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            DB::rollBack();
            throw $ve;
        } catch (\Illuminate\Database\QueryException $qe) {
            DB::rollBack();
            // Unique violation (Postgres 23505) - email already taken including soft-deleted
            if ($qe->getCode() === '23505' || str_contains($qe->getMessage(), 'users_email_unique')) {
                return response()->json([
                    'status' => 'failed',
                    'message' => ['email' => ['This email is already taken, including by a deactivated or terminated account.']]
                ], 400);
            }
            return response()->json([
                'status' => 'failed',
                'message' => 'User creation failed: ' . $qe->getMessage()
            ], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => 'User creation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List users for the logged-in user's company (with permission checks)
     */
    /**
     * Permissions whose owner needs to browse the company user directory as
     * part of their own workflow (picking an approver/driver/dispatcher on a
     * requisition or order) even without full User Management rights.
     */
    protected const USER_BROWSING_WORKFLOW_PERMISSIONS = [
        'can_view_users',
        'can_create_requisitions',
        'can_update_requisitions',
        'can_approve_requisitions',
        'can_create_orders',
        'can_update_orders',
        'can_dispatch_orders',
    ];

    public function index(Request $request)
    {
        try {
            return $this->executeWithRetry(function () use ($request) {
                $user = $request->user();
                $canBrowseUsers = collect(self::USER_BROWSING_WORKFLOW_PERMISSIONS)
                    ->contains(fn ($permission) => $this->hasPermission($request, $permission, $user->company_id));

                if (!$canBrowseUsers) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to view users.',
                    ], 403);
                }

                $query = User::with(['company', 'role']);
                $companyId = $user->company_id;

                // If user is system admin and explicitly requests another company
                if ($this->hasPermission($request, 'can_manage_system') && $request->filled('company_id')) {
                    $companyId = $request->input('company_id');
                }

                $query->where('company_id', $companyId);

                if ($request->filled('is_active')) {
                    $isActiveValue = $request->input('is_active');
                    $bool = filter_var($isActiveValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                    if ($bool !== null) {
                        $query->where('is_active', $bool);
                    }
                }
                if ($request->filled('email')) {
                    $query->where('email', 'ilike', '%' . $request->input('email') . '%');
                }
                if ($request->filled('first_name')) {
                    $query->where('first_name', 'ilike', '%' . $request->input('first_name') . '%');
                }
                if ($request->filled('last_name')) {
                    $query->where('last_name', 'ilike', '%' . $request->input('last_name') . '%');
                }
                if ($request->boolean('include_deleted')) {
                    $query->withTrashed();
                } elseif ($request->boolean('only_deleted')) {
                    $query->onlyTrashed();
                }
                if ($request->filled('role_scope')) {
                    $roleScope = $request->input('role_scope');
                    if ($roleScope === 'warehouse_incharge') {
                        $query->whereHas('role', function ($q) {
                            $q->whereRaw('is_warehouse_incharge = true');
                        });
                    } elseif ($roleScope === 'exclude_sales_rep') {
                        // Sales Reps are "ground people" and shouldn't show up as
                        // eligible dispatch approvers - but a user with no role
                        // assigned yet is by definition not a rep, so include them.
                        $query->where(function ($q) {
                            $q->whereDoesntHave('role')
                                ->orWhereHas('role', function ($rq) {
                                    $rq->whereRaw('is_sales_rep = false');
                                });
                        });
                    } elseif (str_starts_with($roleScope, 'can_')) {
                        // A permission-key scope (e.g. "can_approve_requisitions") restricts
                        // the list to users whose role actually holds that permission, plus
                        // company/system admins who bypass every granular check anyway.
                        $query->whereHas('role.permissions', function ($q) use ($roleScope) {
                            $q->whereIn('key', [$roleScope, 'can_manage_company', 'can_manage_system']);
                        });
                    }
                }

                $users = $query->orderBy('first_name', 'asc')->get();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Users retrieved successfully.',
                    'users' => $users,
                ], 200);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching users');
        }
    }

    public function createNewUser(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|unique:users,email',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'required|string|max:50',
            'company_name' => 'required|string|max:255|unique:companies,name',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        // Explicit withTrashed check before creating company (avoid orphan company on duplicate)
        if (User::withTrashed()->where('email', $request->input('email'))->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => ['email' => ['This email is already taken, including by a deactivated or terminated account. Use a different email or restore the deleted account.']]
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Create company first
            $company = Company::create([
                'id' => (string) Str::uuid(),
                'name' => $request->input('company_name'),
                'is_active' => true,
            ]);

            // Generate a password setup token
            $passwordSetupToken = Str::random(64);
            $passwordSetupTokenExpires = now()->addHours(24);


            // Ensure booleans are cast as proper PostgreSQL-compatible values
            $isActive = filter_var(true, FILTER_VALIDATE_BOOLEAN);
            $emailVerified = filter_var(false, FILTER_VALIDATE_BOOLEAN);

            // Detect frontend URL from the request
            $frontendUrl = $request->header('Origin') ?? $request->header('Referer') ?? config('app.frontend_url', 'https://cherry360.africa');
            // Clean the URL to get just the base
            if (filter_var($frontendUrl, FILTER_VALIDATE_URL)) {
                $parsedUrl = parse_url($frontendUrl);
                $frontendUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
            }
            $frontendUrl = rtrim($frontendUrl, '/');

            // Create user with company_id, no password yet
            $user = User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'email' => $request->input('email'),
                'password' => null, // No password yet
                'first_name' => $request->input('first_name'),
                'last_name' => $request->input('last_name'),
                'phone' => $request->input('phone'),
                'is_active' => $isActive,
                'email_verified' => $emailVerified,
                'password_setup_token' => $passwordSetupToken,
                'password_setup_token_expires_at' => $passwordSetupTokenExpires,
                'frontend_url' => $frontendUrl,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Send email verification with password setup link (customize notification as needed)
            $passwordSetupUrl = $frontendUrl . "/set-password?token=$passwordSetupToken&id={$user->id}";
            Notification::send($user, new VerifyEmailNotification($passwordSetupUrl));

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'User and company created successfully. Please verify your email and set your password.',
                'user' => $user,
                'company' => $company,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            DB::rollBack();
            throw $ve;
        } catch (\Illuminate\Database\QueryException $qe) {
            DB::rollBack();
            if ($qe->getCode() === '23505' || str_contains($qe->getMessage(), 'users_email_unique')) {
                return response()->json([
                    'status' => 'failed',
                    'message' => ['email' => ['This email is already taken, including by a deactivated or terminated account.']]
                ], 400);
            }
            return response()->json([
                'status' => 'failed',
                'message' => 'Registration failed: ' . $qe->getMessage()
            ], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => 'Registration failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        // Include trashed check for terminated accounts
        $user = User::withTrashed()->where('email', $request->input('email'))->first();

        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid credentials.',
            ], 401);
        }

        if ($user->trashed()) {
            $msg = $user->terminated_at ? 'Account has been terminated. Please contact support.' : 'Account has been deactivated. Please contact support.';
            return response()->json([
                'status' => 'failed',
                'message' => $msg,
            ], 403);
        }

        // Check if user has set a password yet
        if (empty($user->password) || is_null($user->password)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Please set your password using the link sent to your email before logging in.',
            ], 403);
        }

        if (!Hash::check($request->input('password'), $user->password)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid credentials.',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account is inactive. Please contact support.',
            ], 403);
        }

        if (!$user->hasVerifiedEmail()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Please verify your email address.',
            ], 403);
        }

        // Generate Sanctum token
        $token = $user->createToken('api-token')->plainTextToken;

        // Update last login timestamp
        $user->forceFill(['last_login_at' => now()])->save();

        $role = $user->role;
        $permissions = $role && isset($role->permissions) ? $role->permissions : [];
        return response()->json([
            'status' => 'success',
            'message' => 'Login successful.',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'phone' => $user->phone,
                    'is_active' => $user->is_active,
                    'email_verified' => $user->email_verified,
                    'company' => $user->company ? [
                        'id' => $user->company->id,
                        'name' => $user->company->name,
                        'is_active' => $user->company->is_active,
                    ] : null,
                    'role' => $role ? [
                        'id' => $role->id,
                        'name' => $role->name,
                        'description' => $role->description,
                        'is_sales_rep' => (bool) $role->is_sales_rep,
                        'is_warehouse_incharge' => (bool) $role->is_warehouse_incharge,
                        'permissions' => $permissions,
                    ] : null,
                ],
            ],
        ], 200);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized.',
            ], 401);
        }

        // Revoke all tokens for the user
        $user->tokens()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logged out successfully.',
        ], 200);
    }

    public function setPasswordAfterVerification(Request $request, $userId)
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = User::find($userId);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found.',
            ], 404);
        }

        // Validate the token and expiry
        if (!$user->password_setup_token || $user->password_setup_token !== $request->token) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid or expired token.',
            ], 400);
        }
        if ($user->password_setup_token_expires_at && now()->greaterThan($user->password_setup_token_expires_at)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Token has expired.',
            ], 400);
        }
        // Optionally, check email_verified if required
        if (!$user->email_verified) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Email not verified.',
            ], 403);
        }

        $user->password = Hash::make($request->password);
        $user->password_setup_token = null;
        $user->password_setup_token_expires_at = null;
        $user->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Password set successfully. You can now log in.',
        ], 200);
    }
}
