<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class PermissionController extends Controller
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
     * Get all available permissions for the user's context
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        $category = $request->input('category');
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view permissions.',
            ], 403);
        }
        $query = Permission::query();
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $companyId);
        }
        if ($category) {
            $query->where('category', $category);
        }
        $permissions = $query->with(['company', 'creator'])
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->groupBy('category');
        return response()->json([
            'status' => 'success',
            'message' => 'Permissions retrieved successfully',
            'permissions' => $permissions,
        ], 200);
    }

    /**
     * Create a new permission (System Admin or Company Admin)
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create permissions.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'category' => 'required|string|max:50',
            'company_id' => 'nullable|uuid|exists:companies,id',
            'is_system' => 'boolean',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        // Generate permission key
        $key = Permission::generateKey($request->name);

        // Determine if this is a system or company permission
        $isSystem = filter_var($request->input('is_system', false), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($isSystem === null) $isSystem = false;
        $companyId = $request->input('company_id', $user->company_id);

        // Check if permission key already exists
        if (Permission::keyExists($key, $isSystem ? null : $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Permission with this name already exists',
                'suggested_key' => $key . '_' . time()
            ], 400);
        }

        try {
            $permission = Permission::create([
                'id' => (string) Str::uuid(),
                'name' => $request->name,
                'key' => $key,
                'description' => $request->description,
                'category' => $request->category,
                'company_id' => $isSystem ? null : $companyId,
                'is_system' => $isSystem ? true : false,
                'is_active' => true,
                'created_by' => $user->id,
                'metadata' => $request->metadata ?? [],
            ]);

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'permission_created',
                "Created new permission: {$permission->name}",
                $user,
                ['permission_id' => $permission->id, 'permission_key' => $permission->key]
            );

            $role = $user->role;
            return response()->json([
                'status' => 'success',
                'message' => 'Permission created successfully',
                'permission' => $permission->load(['company', 'creator']),
                'user_permissions' => $role && $role->permissions ? $role->permissions->pluck('key')->toArray() : [],
                'user_role' => $role ? $role->name : null,
                'user_role_id' => $role ? $role->id : null,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create permission: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update an existing permission
     */
    public function update(Request $request, $permissionId)
    {
        $user = $request->user();
        $permission = Permission::find($permissionId);
        $companyId = $permission ? $permission->company_id : null;
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update permissions.',
            ], 403);
        }

        if (!$permission) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Permission not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'description' => 'sometimes|nullable|string|max:500',
            'category' => 'sometimes|string|max:50',
            'is_active' => 'sometimes', // Accept any value, cast below
            'metadata' => 'sometimes|nullable|array',
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
                $bool = filter_var($updateData['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                $updateData['is_active'] = $bool === null ? false : $bool;
            }

            // Update key if name changed
            if (isset($updateData['name']) && $updateData['name'] !== $permission->name) {
                $newKey = Permission::generateKey($updateData['name']);

                // Check if new key conflicts
                $companyId = $permission->is_system ? null : $permission->company_id;
                if (Permission::keyExists($newKey, $companyId) && $newKey !== $permission->key) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Permission with this name already exists',
                        'suggested_key' => $newKey . '_' . time()
                    ], 400);
                }

                $updateData['key'] = $newKey;
            }

            $permission->update($updateData);

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'permission_updated',
                "Updated permission: {$permission->name}",
                $user,
                ['permission_id' => $permission->id, 'changes' => $updateData]
            );

            $role = $user->role;
            return response()->json([
                'status' => 'success',
                'message' => 'Permission updated successfully',
                'permission' => $permission->load(['company', 'creator']),
                'user_permissions' => $role && $role->permissions ? $role->permissions->pluck('key')->toArray() : [],
                'user_role' => $role ? $role->name : null,
                'user_role_id' => $role ? $role->id : null,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update permission: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a permission
     */
    public function destroy(Request $request, $permissionId)
    {
        $user = $request->user();
        $permission = Permission::find($permissionId);
        $companyId = $permission ? $permission->company_id : null;
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete permissions.',
            ], 403);
        }

        if (!$permission) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Permission not found'
            ], 404);
        }

        // Check if permission is assigned to any roles
        $assignedRoles = $permission->roles()->count();
        if ($assignedRoles > 0) {
            return response()->json([
                'status' => 'failed',
                'message' => "Cannot delete permission assigned to {$assignedRoles} role(s)",
                'assigned_roles_count' => $assignedRoles
            ], 400);
        }

        try {
            $permissionName = $permission->name;
            $permission->delete();

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'permission_deleted',
                "Deleted permission: {$permissionName}",
                $user,
                ['permission_id' => $permissionId]
            );

            $role = $user->role;
            return response()->json([
                'status' => 'success',
                'message' => 'Permission deleted successfully',
                'user_permissions' => $role && $role->permissions ? $role->permissions->pluck('key')->toArray() : [],
                'user_role' => $role ? $role->name : null,
                'user_role_id' => $role ? $role->id : null,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete permission: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assign permissions to a role
     */
    public function assignToRole(Request $request, $roleId)
    {
        $user = $request->user();
        $role = Role::find($roleId);
        $companyId = $role ? $role->company_id : null;
        if (!$role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'permission_ids' => 'required|array|min:1',
            'permission_ids.*' => 'uuid|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        try {
            DB::beginTransaction();

            $permissionIds = $request->permission_ids;

            // If user has can_manage_system, allow all permissions
            if ($user->role && $user->role->hasPermission('can_manage_system')) {
                $availablePermissions = Permission::whereIn('id', $permissionIds)
                    ->pluck('id')
                    ->toArray();
            } else {
                // Otherwise, restrict to system or company permissions
                $availablePermissions = Permission::whereIn('id', $permissionIds)
                    ->where(function ($q) use ($role) {
                        $q->whereRaw('is_system = true')
                            ->orWhere('company_id', $role->company_id);
                    })
                    ->pluck('id')
                    ->toArray();
            }

            $invalidPermissions = array_diff($permissionIds, $availablePermissions);
            if (!empty($invalidPermissions)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Some permissions are not available for this company',
                    'invalid_permissions' => $invalidPermissions
                ], 400);
            }

            // Remove all current permissions, then attach new ones
            $role->permissions()->detach();
            foreach ($permissionIds as $pid) {
                if (!$role->permissions()->where('permissions.id', $pid)->exists()) {
                    $role->permissions()->attach($pid, [
                        'granted_by' => $user->id,
                        'granted_at' => now(),
                    ]);
                }
            }

            DB::commit();

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'permissions_assigned_to_role',
                "Assigned " . count($permissionIds) . " permissions to role: {$role->name}",
                $user,
                ['role_id' => $role->id, 'permission_ids' => $permissionIds]
            );

            $userRole = $user->role;
            return response()->json([
                'status' => 'success',
                'message' => 'Permissions assigned to role successfully',
                'role' => $role->load(['permissions', 'company']),
                'user_permissions' => $userRole && $userRole->permissions ? $userRole->permissions->pluck('key')->toArray() : [],
                'user_role' => $userRole ? $userRole->name : null,
                'user_role_id' => $userRole ? $userRole->id : null,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to assign permissions: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get permission categories
     */
    public function getCategories(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        $categories = Permission::getCategories($companyId);

        return response()->json([
            'status' => 'success',
            'message' => 'Permission categories retrieved successfully',
            'categories' => $categories,
        ], 200);
    }

    /**
     * Bulk create permissions from a predefined set
     */
    public function bulkCreate(Request $request)
    {
        $user = $request->user();

        // Only allow users with can_manage_system_permissions
        if (!$this->hasPermission($request, 'can_manage_system_permissions', true)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to bulk create permissions.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'permissions' => 'required|array|min:1',
            'permissions.*.name' => 'required|string|max:100',
            'permissions.*.description' => 'nullable|string|max:500',
            'permissions.*.category' => 'required|string|max:50',
            'company_id' => 'nullable|uuid|exists:companies,id',
            'is_system' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        $isSystem = filter_var($request->input('is_system', false), FILTER_VALIDATE_BOOLEAN);
        $companyId = $request->input('company_id', $user->company_id);

        try {
            DB::beginTransaction();

            $createdPermissions = [];
            $skippedPermissions = [];

            foreach ($request->permissions as $permissionData) {
                $key = Permission::generateKey($permissionData['name']);

                // Skip if permission already exists
                if (Permission::keyExists($key, $isSystem ? null : $companyId)) {
                    $skippedPermissions[] = [
                        'name' => $permissionData['name'],
                        'key' => $key,
                        'reason' => 'Already exists'
                    ];
                    continue;
                }

                $permission = Permission::create([
                    'id' => (string) Str::uuid(),
                    'name' => $permissionData['name'],
                    'key' => $key,
                    'description' => $permissionData['description'] ?? null,
                    'category' => $permissionData['category'],
                    'company_id' => $isSystem ? null : $companyId,
                    'is_system' => $isSystem,
                    'is_active' => true,
                    'created_by' => $user->id,
                    'metadata' => [],
                ]);

                $createdPermissions[] = $permission;
            }

            DB::commit();

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'bulk_permissions_created',
                "Bulk created " . count($createdPermissions) . " permissions",
                $user,
                [
                    'created_count' => count($createdPermissions),
                    'skipped_count' => count($skippedPermissions),
                    'is_system' => $isSystem
                ]
            );

            $role = $user->role;
            return response()->json([
                'status' => 'success',
                'message' => 'Bulk permission creation completed',
                'created' => $createdPermissions,
                'skipped' => $skippedPermissions,
                'summary' => [
                    'created_count' => count($createdPermissions),
                    'skipped_count' => count($skippedPermissions),
                ],
                'user_permissions' => $role && $role->permissions ? $role->permissions->pluck('key')->toArray() : [],
                'user_role' => $role ? $role->name : null,
                'user_role_id' => $role ? $role->id : null,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'failed',
                'message' => 'Bulk permission creation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if user has system admin permission
     */
    private function hasSystemAdminPermission($user)
    {
        if (!$user->role) return false;
        $systemAdminPermissions = [
            'can_access_admin_portal',
            'can_manage_all_users',
            'can_manage_companies',
            'can_manage_system_permissions'
        ];
        foreach ($systemAdminPermissions as $permKey) {
            if ($user->role->hasPermission($permKey)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if user can manage a specific permission
     */
    private function canManagePermission($user, $permission)
    {
        // System admins can manage all permissions
        if ($this->hasSystemAdminPermission($user)) {
            return true;
        }
        // Company admins can only manage their company's permissions
        if ($permission->is_system) {
            return false; // Only system admins can manage system permissions
        }
        return $permission->company_id === $user->company_id &&
            $user->role &&
            $user->role->hasPermission('can_manage_company');
    }
}
