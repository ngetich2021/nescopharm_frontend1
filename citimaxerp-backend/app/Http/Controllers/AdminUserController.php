<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class AdminUserController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

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
     * Get all users across all companies (System Admin only)
     */
    public function getAllUsers(Request $request)
    {

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view users.',
            ], 403);
        }
        // Add pagination and filtering
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search');
        $companyId = $request->input('company_id');
        $status = $request->input('status'); // active, inactive, all
        $role = $request->input('role');

        $query = User::with(['company', 'role'])
            ->select('users.*');

        // Search functionality
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'ilike', "%{$search}%")
                    ->orWhere('last_name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%");
            });
        }

        // Filter by company
        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        // Filter by status (keep for explicit filtering only)
        if ($status && $status !== 'all') {
            if ($status === 'active') {
                $query->whereRaw('is_active = true');
            } else {
                $query->whereRaw('is_active = false');
            }
        }

        // Filter by role
        if ($role) {
            $query->whereHas('role', function ($q) use ($role) {
                $q->where('name', $role);
            });
        }

        $users = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Add additional statistics
        $stats = [
            'total_users' => User::count(),
            'active_users' => User::whereRaw('is_active = true')->count(),
            'inactive_users' => User::whereRaw('is_active = false')->count(),
            'verified_users' => User::whereRaw('email_verified = true')->count(),
            'unverified_users' => User::whereRaw('email_verified = false')->count(),
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Users retrieved successfully',
            'data' => $users,
            'stats' => $stats,
        ], 200);
    }

    /**
     * Get users for a specific company (Company Admin)
     */
    public function getCompanyUsers(Request $request, $companyId)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        $role = $user->role;
        // If user has can_manage_system, allow viewing all permissions
        if ($role && $role->hasPermission('can_manage_system')) {
            // System admin: show all permissions (system + all companies)
        } else if (!$this->hasPermission($request, 'can_view_all_users')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view users.',
            ], 403);
        }
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search');
        $status = $request->input('status');
        $role = $request->input('role');

        $query = User::with(['role'])
            ->where('company_id', $companyId);

        // Search functionality
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'ilike', "%{$search}%")
                    ->orWhere('last_name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%");
            });
        }

        // Filter by status (keep for explicit filtering only)
        if ($status && $status !== 'all') {
            if ($status === 'active') {
                $query->whereRaw('is_active = true');
            } else {
                $query->whereRaw('is_active = false');
            }
        }

        // Filter by role
        if ($role) {
            $query->whereHas('role', function ($q) use ($role) {
                $q->where('name', $role);
            });
        }

        $users = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Company-specific statistics
        $stats = [
            'total_users' => User::where('company_id', $companyId)->count(),
            'active_users' => User::where('company_id', $companyId)->whereRaw('is_active = true')->count(),
            'inactive_users' => User::where('company_id', $companyId)->whereRaw('is_active = false')->count(),
            'verified_users' => User::where('company_id', $companyId)->whereRaw('email_verified = true')->count(),
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Company users retrieved successfully',
            'data' => $users,
            'stats' => $stats,
        ], 200);
    }

    /**
     * Create a new user (Admin only)
     */
    public function createUser(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create users.',
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'required|string|max:50',
            'company_id' => 'required|uuid|exists:companies,id',
            'role_id' => 'nullable|uuid|exists:roles,id',
            'is_active' => 'boolean',
            'email_verified' => 'boolean',
            'avatar_url' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        if (User::withTrashed()->where('email', $request->email)->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => ['email' => ['This email is already taken, including by a deactivated or terminated account. Use a different email or restore the deleted account.']]
            ], 400);
        }

        DB::beginTransaction();
        try {
            // Check subscription limits
            $company = Company::with('currentSubscription.plan')->find($request->company_id);
            if ($company && $company->currentSubscription && $company->currentSubscription->plan) {
                $maxUsers = $company->currentSubscription->plan->max_users;
                if ($maxUsers && $company->users()->count() >= $maxUsers) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Company has reached its user limit for the current subscription plan'
                    ], 400);
                }
            }

            $user = User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $request->company_id,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'phone' => $request->phone,
                'role_id' => $request->role_id,
                'is_active' => filter_var($request->input('is_active', true), FILTER_VALIDATE_BOOLEAN),
                'email_verified' => filter_var($request->input('email_verified', false), FILTER_VALIDATE_BOOLEAN),
                'avatar_url' => $request->avatar_url,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'User created successfully',
                'user' => $user->load(['company', 'role']),
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
                'message' => 'Failed to create user: ' . $qe->getMessage()
            ], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update user details (Admin) — now supports roles + permission_ids with company-scoped validation
     */
    public function updateUser(Request $request, $userId)
    {
        $authUser = $request->user();
        $companyId = $request->input('company_id', $authUser->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update users.',
            ], 403);
        }
        $target = User::withTrashed()->find($userId);
        if (!$target) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found'
            ], 404);
        }
        if ($target->trashed()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot update a deleted/terminated account. Restore it first.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'email' => 'sometimes|email|unique:users,email,' . $userId,
            'password' => 'sometimes|min:8',
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|nullable|string|max:50',
            'role_id' => 'sometimes|nullable|uuid|exists:roles,id',
            'is_active' => 'sometimes|boolean',
            'email_verified' => 'sometimes|boolean',
            'avatar_url' => 'sometimes|nullable|string|max:500',
            'permission_ids' => 'sometimes|array',
            'permission_ids.*' => 'uuid|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        try {
            $updateData = $validator->validated();

            // Handle boolean values properly
            if (isset($updateData['is_active'])) {
                $updateData['is_active'] = filter_var($updateData['is_active'], FILTER_VALIDATE_BOOLEAN);
            }
            if (isset($updateData['email_verified'])) {
                $updateData['email_verified'] = filter_var($updateData['email_verified'], FILTER_VALIDATE_BOOLEAN);
            }
            // Hash password if provided
            if (isset($updateData['password'])) {
                $updateData['password'] = Hash::make($updateData['password']);
            }

            // Company-scoped role validation
            if (array_key_exists('role_id', $updateData) && !empty($updateData['role_id'])) {
                $roleBelongs = \App\Models\Role::where('id', $updateData['role_id'])
                    ->where('company_id', $target->company_id)->exists();
                if (!$roleBelongs) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Role does not belong to this user\'s company.'
                    ], 400);
                }
            }

            $permissionIds = $updateData['permission_ids'] ?? null;
            unset($updateData['permission_ids']);

            DB::beginTransaction();

            if (!empty($updateData)) {
                $target->update($updateData);
            }

            if ($permissionIds !== null) {
                $roleId = $updateData['role_id'] ?? $target->role_id;
                if (!$roleId) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Assign a role before assigning permissions.'
                    ], 400);
                }
                $role = \App\Models\Role::where('id', $roleId)->where('company_id', $target->company_id)->first();
                if (!$role) {
                    DB::rollBack();
                    return response()->json(['status'=>'failed','message'=>'Role not found for this company.'],404);
                }
                $available = \App\Models\Permission::whereIn('id', $permissionIds)
                    ->where(function($q) use ($target){ $q->whereRaw('is_system = true')->orWhere('company_id',$target->company_id); })
                    ->pluck('id')->toArray();
                $invalid = array_diff($permissionIds, $available);
                if (!empty($invalid)) {
                    DB::rollBack();
                    return response()->json(['status'=>'failed','message'=>'Some permissions are not available for this company.','invalid_permissions'=>array_values($invalid)],400);
                }
                $role->permissions()->sync($permissionIds);
                foreach ($permissionIds as $pid) {
                    DB::table('role_permissions')->where('role_id',$role->id)->where('permission_id',$pid)
                        ->update(['granted_by'=>$authUser->id,'granted_at'=>now()]);
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'User updated successfully',
                'user' => $target->refresh()->load(['company', 'role.permissions']),
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
     * Toggle user active status
     */
    public function toggleUserStatus(Request $request, $userId)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        $role = $user->role;
        // If user has can_manage_system, allow viewing all permissions
        if ($role && $role->hasPermission('can_manage_system')) {
            // System admin: show all permissions (system + all companies)
        } else if (!$this->hasPermission($request, 'can_update_all_users')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update users.',
            ], 403);
        }
        $user = User::find($userId);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found'
            ], 404);
        }

        try {
            $user->update(['is_active' => !$user->is_active]);

            return response()->json([
                'status' => 'success',
                'message' => $user->is_active ? 'User activated successfully' : 'User deactivated successfully',
                'user' => $user->load(['company', 'role']),
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to toggle user status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete user by deactivating and soft-deleting the account.
     */
    public function deleteUser(Request $request, $userId)
    {
        $userModel = User::withTrashed()->find($userId);
        if (!$userModel) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found'
            ], 404);
        }
        $companyId = $userModel->company_id;
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this user.',
            ], 403);
        }
        if ($userModel->id === $request->user()->id) {
            return response()->json(['status'=>'failed','message'=>'You cannot delete your own account.'],400);
        }
        if ($userModel->trashed()) {
            return response()->json(['status'=>'failed','message'=>'User is already deleted.'],400);
        }
        // Prevent deleting last super_admin
        if ($userModel->role && $userModel->role->name === 'super_admin') {
            $remaining = User::where('company_id',$userModel->company_id)->where('id','!=',$userModel->id)->whereHas('role', fn($q)=>$q->where('name','super_admin'))->count();
            if ($remaining===0) {
                return response()->json(['status'=>'failed','message'=>'Cannot delete the last super admin for this company.'],400);
            }
        }
        try {
            $userModel->update(['is_active' => false]);
            $userModel->tokens()->delete();
            $userModel->delete();
            $message = 'User soft-deleted successfully. Use restore to recover.';
            return response()->json([
                'status' => 'success',
                'message' => $message,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Terminate user account (admin)
     */
    public function terminateUser(Request $request, $userId)
    {
        $userModel = User::find($userId);
        if (!$userModel) {
            return response()->json(['status'=>'failed','message'=>'User not found'],404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $userModel->company_id)) {
            return response()->json(['status'=>'failed','message'=>'Unauthorized to terminate this user.'],403);
        }
        if ($userModel->id === $request->user()->id) {
            return response()->json(['status'=>'failed','message'=>'You cannot terminate your own account.'],400);
        }
        if ($userModel->trashed()) {
            return response()->json(['status'=>'failed','message'=>'User is already deleted/terminated.'],400);
        }
        $validator = Validator::make($request->all(), ['reason'=>'nullable|string|max:500']);
        if ($validator->fails()) {
            return response()->json(['status'=>'failed','message'=>$validator->errors()],400);
        }
        if ($userModel->role && $userModel->role->name==='super_admin') {
            $remaining = User::where('company_id',$userModel->company_id)->where('id','!=',$userModel->id)->whereHas('role', fn($q)=>$q->where('name','super_admin'))->count();
            if ($remaining===0) return response()->json(['status'=>'failed','message'=>'Cannot terminate the last super admin.'],400);
        }
        $userModel->terminate($request->input('reason'), $request->user()->id);
        return response()->json(['status'=>'success','message'=>'User terminated successfully.'],200);
    }

    /**
     * Restore soft-deleted / terminated user (admin)
     */
    public function restoreUser(Request $request, $userId)
    {
        $userModel = User::withTrashed()->find($userId);
        if (!$userModel) return response()->json(['status'=>'failed','message'=>'User not found'],404);
        if (!$userModel->trashed()) return response()->json(['status'=>'failed','message'=>'User is not deleted.'],400);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $userModel->company_id)) {
            return response()->json(['status'=>'failed','message'=>'Unauthorized to restore this user.'],403);
        }
        $userModel->restoreAccount();
        $userModel->update(['is_active'=>true]);
        return response()->json(['status'=>'success','message'=>'User restored successfully.','user'=>$userModel->load(['company','role'])],200);
    }

    /**
     * Get user activity logs
     */
    public function getUserActivity(Request $request, $userId)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        $role = $user->role;
        // If user has can_manage_system, allow viewing all permissions
        if ($role && $role->hasPermission('can_manage_system')) {
            // System admin: show all permissions (system + all companies)
        } else if (!$this->hasPermission($request, 'can_view_all_users')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view users.',
            ], 403);
        }

        $user = User::find($userId);
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found'
            ], 404);
        }

        // This would require an activity log system to be implemented
        $activity = [
            'last_login' => $user->last_login_at,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
            'total_logins' => 0, // Would need to track this
            'last_activity' => null, // Would need to track this
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'User activity retrieved successfully',
            'activity' => $activity,
        ], 200);
    }

    /**
     * Bulk operations on users
     */
    public function bulkOperation(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'operation' => 'required|in:activate,deactivate,delete,assign_role',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'uuid|exists:users,id',
            'role_id' => 'required_if:operation,assign_role|uuid|exists:roles,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        try {
            $userIds = $request->user_ids;
            $operation = $request->operation;
            $affected = 0;

            switch ($operation) {
                case 'activate':
                    $affected = User::whereIn('id', $userIds)->update(['is_active' => true]);
                    break;

                case 'deactivate':
                    $affected = User::whereIn('id', $userIds)->update(['is_active' => false]);
                    break;

                case 'delete':
                    $affected = User::whereIn('id', $userIds)->update(['is_active' => false]);
                    break;

                case 'assign_role':
                    $affected = User::whereIn('id', $userIds)->update(['role_id' => $request->role_id]);
                    break;
            }

            return response()->json([
                'status' => 'success',
                'message' => "Bulk {$operation} completed successfully",
                'affected_count' => $affected,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bulk operation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export users data
     */
    public function exportUsers(Request $request)
    {
        $format = $request->input('format', 'csv'); // csv, excel, pdf
        $companyId = $request->input('company_id');

        $query = User::with(['company', 'role']);

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $users = $query->get();

        // This would require implementation of export functionality
        // For now, return data that can be exported
        return response()->json([
            'status' => 'success',
            'message' => 'Users data ready for export',
            'data' => $users,
            'format' => $format,
        ], 200);
    }
}
