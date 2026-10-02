<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @param  string  $permission
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized'
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

        // Check permission using new dynamic system
        if (!$user->role->hasPermission($permission)) {
            // Fallback to legacy permission system for backward compatibility
            $legacyPermissions = $user->role->permissions ?? [];
            if (!isset($legacyPermissions[$permission]) || !$legacyPermissions[$permission]) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Insufficient permissions',
                    'required_permission' => $permission
                ], 403);
            }
        }

        return $next($request);
    }
}
