<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class RoleController extends Controller
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


    public function createRole(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create roles.',
                'data' => null
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50|unique:roles,name',
            'description' => 'nullable|string',
            'permission_ids' => 'array',
            'permission_ids.*' => 'uuid|exists:permissions,id',
            'is_active' => 'boolean',
            'is_sales_rep' => 'boolean',
            'is_warehouse_incharge' => 'boolean',
            // 'company_id' is not accepted from the request
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $role = Role::create([
                'id' => (string) Str::uuid(),
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'is_active' => filter_var($request->input('is_active', true), FILTER_VALIDATE_BOOLEAN),
                'is_sales_rep' => filter_var($request->input('is_sales_rep', false), FILTER_VALIDATE_BOOLEAN),
                'is_warehouse_incharge' => filter_var($request->input('is_warehouse_incharge', false), FILTER_VALIDATE_BOOLEAN),
                'company_id' => $user->company_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Add only new permissions (prevent duplicates)
            $newPermissionIds = array_diff(
                $request->input('permission_ids'),
                $role->permissions()->pluck('id')->toArray()
            );
            if (!empty($newPermissionIds)) {
                $role->permissions()->attach($newPermissionIds);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Role created successfully.',
                'role' => $role->load('permissions'),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create role: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * View permissions of a particular role
     */
    public function showRolePermissions(Request $request, $roleId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view roles.',
                'data' => null
            ], 403);
        }

        // If user has can_manage_system, allow viewing any role
        if ($user->role && $user->role->hasPermission('can_manage_system')) {
            $role = Role::where('id', $roleId)
                ->with(['permissions', 'company'])
                ->first();
        } else {
            $role = Role::where('id', $roleId)
                ->where('company_id', $user->company_id)
                ->with(['permissions', 'company'])
                ->first();
        }
        if (!$role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role not found or does not belong to your company.',
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Role permissions retrieved successfully.',
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions,
                'company' => $role->company,
            ],
        ], 200);
    }

    public function assignRole(Request $request, $userId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_assign_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to assign roles.',
                'data' => null
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'role_id' => 'required|uuid|exists:roles,id',
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

        $role = Role::where('id', $request->input('role_id'))
            ->where('company_id', $user->company_id)
            ->first();
        if (!$role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role not found or does not belong to your company.',
            ], 404);
        }

        try {
            $user->forceFill(['role_id' => $role->id])->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Role assigned successfully.',
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'role' => [
                        'id' => $role->id,
                        'name' => $role->name,
                    ],
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to assign role: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function updatePermissions(Request $request, $roleId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update roles.',
                'data' => null
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'uuid|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $role = Role::where('id', $roleId)
            ->where('company_id', $user->company_id)
            ->first();
        if (!$role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role not found or does not belong to your company.',
            ], 404);
        }

        try {
            // Validate that all permissions are available to this company
            $permissionIds = $request->permission_ids;
            $availablePermissions = \App\Models\Permission::whereIn('id', $permissionIds)
                ->where(function ($q) use ($role) {
                    $q->whereRaw('is_system = true')
                        ->orWhere('company_id', $role->company_id);
                })
                ->pluck('id')
                ->toArray();

            $invalidPermissions = array_diff($permissionIds, $availablePermissions);
            if (!empty($invalidPermissions)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Some permissions are not available for this company',
                    'invalid_permissions' => $invalidPermissions
                ], 400);
            }

            // Add only new permissions (prevent duplicates)
            $newPermissionIds = array_diff(
                $permissionIds,
                $role->permissions()->pluck('id')->toArray()
            );
            if (!empty($newPermissionIds)) {
                $role->permissions()->attach($newPermissionIds);
            }

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'role_permissions_updated',
                "Updated permissions for role: {$role->name}",
                $user,
                ['role_id' => $role->id, 'permission_count' => count($permissionIds)]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Permissions updated successfully.',
                'role' => $role->load(['permissions', 'company']),
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update permissions: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check if user has system admin permission
     */
    private function hasSystemAdminPermission($user)
    {
        if (!$user->role) return false;

        $permissions = $user->role->getPermissionKeys();
        $systemAdminPermissions = [
            'can_access_admin_portal',
            'can_manage_all_users',
            'can_manage_companies',
            'can_manage_system_permissions'
        ];

        return !empty(array_intersect($permissions, $systemAdminPermissions));
    }

    /**
     * Get all roles (Admin view)
     */
    public function getAllRoles(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_all_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view roles.',
                'data' => null
            ], 403);
        }
        $companyId = $request->input('company_id');

        $query = Role::with(['company', 'users']);

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $roles = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'All roles retrieved successfully.',
            'roles' => $roles,
        ], 200);
    }

    /**
     * Update role details
     */
    public function updateRole(Request $request, $roleId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customers.',
                'data' => null
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:50',
            'description' => 'sometimes|nullable|string',
            'permission_ids' => 'sometimes|array',
            'permission_ids.*' => 'uuid|exists:permissions,id',
            'is_active' => 'sometimes|boolean',
            'is_sales_rep' => 'sometimes|boolean',
            'is_warehouse_incharge' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $role = Role::where('id', $roleId)
            ->where('company_id', $user->company_id)
            ->first();
        if (!$role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role not found or does not belong to your company.',
            ], 404);
        }

        // Check for name uniqueness if name is being updated
        if ($request->has('name')) {
            $existingRole = Role::where('name', $request->name)
                ->where('company_id', $role->company_id)
                ->where('id', '!=', $roleId)
                ->first();
            if ($existingRole) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Role name already exists in this company.',
                ], 400);
            }
        }

        try {
            $updateData = $validator->validated();
            // Handle boolean values properly
            if (isset($updateData['is_active'])) {
                $updateData['is_active'] = filter_var($updateData['is_active'], FILTER_VALIDATE_BOOLEAN);
            }
            if (isset($updateData['is_sales_rep'])) {
                $updateData['is_sales_rep'] = filter_var($updateData['is_sales_rep'], FILTER_VALIDATE_BOOLEAN);
            }
            if (isset($updateData['is_warehouse_incharge'])) {
                $updateData['is_warehouse_incharge'] = filter_var($updateData['is_warehouse_incharge'], FILTER_VALIDATE_BOOLEAN);
            }
            // Remove permission_ids from updateData
            $permissionIds = $updateData['permission_ids'] ?? null;
            unset($updateData['permission_ids']);
            $role->update($updateData);
            // Add only new permissions (prevent duplicates)
            if ($permissionIds !== null) {
                $newPermissionIds = array_diff(
                    $permissionIds,
                    $role->permissions()->pluck('id')->toArray()
                );
                if (!empty($newPermissionIds)) {
                    $role->permissions()->attach($newPermissionIds);
                }
            }
            return response()->json([
                'status' => 'success',
                'message' => 'Role updated successfully.',
                'role' => $role->load('permissions'),
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update role: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete role
     */
    public function deleteRole(Request $request, $roleId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete roles.',
                'data' => null
            ], 403);
        }
        $user = $request->user();
        $role = Role::where('id', $roleId)
            ->where('company_id', $user->company_id)
            ->first();
        if (!$role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role not found or does not belong to your company.',
            ], 404);
        }

        // Check if role is assigned to any users
        if ($role->users()->count() > 0) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete role that is assigned to users.',
            ], 400);
        }

        // Prevent deletion of super_admin role
        if ($role->name === 'super_admin') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete super admin role.',
            ], 400);
        }

        try {
            $role->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Role deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete role: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get available permissions list
     */
    public function getAvailablePermissions(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customers.',
                'data' => null
            ], 403);
        }

        $companyId = $request->input('company_id', $user->company_id);

        // Get permissions available to this company
        $permissions = \App\Models\Permission::getAvailablePermissions($companyId);

        // Convert to the old format for backward compatibility
        $formattedPermissions = [];
        foreach ($permissions as $category => $categoryPermissions) {
            $formattedPermissions[$category] = [];
            foreach ($categoryPermissions as $permission) {
                $formattedPermissions[$category][$permission->key] = $permission->description ?? $permission->name;
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Available permissions retrieved successfully.',
            'permissions' => $formattedPermissions,
            'raw_permissions' => $permissions, // Include raw data for new interfaces
        ], 200);
    }

    /**
     * Clone role with new name
     */
    public function cloneRole(Request $request, $roleId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create roles.',
                'data' => null
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'new_name' => 'required|string|max:50',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $originalRole = Role::where('id', $roleId)
            ->where('company_id', $user->company_id)
            ->first();
        if (!$originalRole) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Original role not found or does not belong to your company.',
            ], 404);
        }

        // Check if new name already exists
        $existingRole = Role::where('name', $request->new_name)
            ->where('company_id', $originalRole->company_id)
            ->first();
        if ($existingRole) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role name already exists in this company.',
            ], 400);
        }

        try {
            $newRole = Role::create([
                'id' => (string) Str::uuid(),
                'name' => $request->new_name,
                'description' => $request->description ?? $originalRole->description,
                'permissions' => $originalRole->permissions,
                'is_active' => true,
                'company_id' => $originalRole->company_id,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Role cloned successfully.',
                'role' => $newRole,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to clone role: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get roles for current user's company
     */
    public function fetchRoles(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_roles', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view roles.',
                'data' => null
            ], 403);
        }
        $user = $request->user();
        $roles = Role::where('company_id', $user->company_id)
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Roles retrieved successfully.',
            'roles' => $roles,
        ], 200);
    }
}
