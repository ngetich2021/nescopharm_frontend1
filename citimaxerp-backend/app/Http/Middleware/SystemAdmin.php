<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SystemAdmin
{
    /**
     * Handle an incoming request for system admin routes.
     * This middleware ensures only system administrators can access certain endpoints.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized - Authentication required'
            ], 401);
        }

        // Check if user is active
        if (!$user->is_active) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account is inactive'
            ], 403);
        }

        // Check if user has a role
        if (!$user->role) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No role assigned'
            ], 403);
        }

        // Check if role is active
        if (!$user->role->is_active) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Role is inactive'
            ], 403);
        }

        // Check for system admin permissions
        $permissions = $user->role->permissions ?? [];
        $systemAdminPermissions = [
            'can_access_admin_portal',
            'can_manage_all_users',
            'can_manage_companies',
            'can_manage_subscriptions',
        ];

        $hasSystemAdminAccess = false;
        foreach ($systemAdminPermissions as $permission) {
            if (isset($permissions[$permission]) && $permissions[$permission]) {
                $hasSystemAdminAccess = true;
                break;
            }
        }

        if (!$hasSystemAdminAccess) {
            return response()->json([
                'status' => 'failed',
                'message' => 'System administrator access required'
            ], 403);
        }

        return $next($request);
    }
}
