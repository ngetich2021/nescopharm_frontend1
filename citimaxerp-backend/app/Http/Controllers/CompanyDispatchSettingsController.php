<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CompanyDispatchSettingsController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request)
    {
        $user = $request->user();
        $role = $user->role;
        
        if (!$role) {
            return false;
        }
        
        // Only system admins or company managers can manage dispatch settings
        return $role->hasPermission('can_manage_system') || 
               $role->hasPermission('can_manage_company');
    }

    /**
     * Get dispatch approval settings for the company
     */
    public function getSettings(Request $request)
    {
        if (!$this->hasPermission($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view dispatch settings.',
            ], 403);
        }

        $user = $request->user();
        
        $settings = CompanySetting::getDispatchApprovalSettings($user->company_id);

        // Load user details for approvers
        if (!empty($settings['default_approvers'])) {
            $userIds = collect($settings['default_approvers'])->pluck('user_id')->toArray();
            $users = User::whereIn('id', $userIds)
                ->select('id', 'first_name', 'last_name', 'email', 'is_active')
                ->get()
                ->keyBy('id');

            $settings['default_approvers'] = collect($settings['default_approvers'])
                ->map(function ($approver) use ($users) {
                    $user = $users->get($approver['user_id']);
                    return [
                        'user_id' => $approver['user_id'],
                        'order' => $approver['order'],
                        'user' => $user,
                    ];
                })
                ->filter(function ($approver) {
                    return $approver['user'] !== null;
                })
                ->values()
                ->toArray();
        }

        return response()->json([
            'success' => true,
            'message' => 'Dispatch settings retrieved successfully',
            'data' => $settings,
        ], 200);
    }

    /**
     * Update dispatch approval settings
     */
    public function updateSettings(Request $request)
    {
        if (!$this->hasPermission($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update dispatch settings.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'default_approvers' => 'required|array|min:1',
            'default_approvers.*.user_id' => 'required|uuid|exists:users,id',
            'default_approvers.*.order' => 'required|integer|min:1',
            'require_approval' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        try {
            // Validate all approvers belong to the company
            $approverIds = collect($request->default_approvers)->pluck('user_id')->toArray();
            $companyUsers = User::whereIn('id', $approverIds)
                ->where('company_id', $user->company_id)
                ->where('is_active', true)
                ->pluck('id')
                ->toArray();

            if (count($companyUsers) !== count($approverIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'All approvers must be active users from your company',
                ], 422);
            }

            // Sort and normalize the order
            $approvers = collect($request->default_approvers)
                ->sortBy('order')
                ->values()
                ->map(function ($approver, $index) {
                    return [
                        'user_id' => $approver['user_id'],
                        'order' => $index + 1,
                    ];
                })
                ->toArray();

            $settings = [
                'default_approvers' => $approvers,
                'require_approval' => $request->get('require_approval', true),
            ];

            CompanySetting::setDispatchApprovalSettings($user->company_id, $settings);

            // Return with user details
            $userIds = collect($approvers)->pluck('user_id')->toArray();
            $users = User::whereIn('id', $userIds)
                ->select('id', 'first_name', 'last_name', 'email', 'is_active')
                ->get()
                ->keyBy('id');

            $settings['default_approvers'] = collect($approvers)
                ->map(function ($approver) use ($users) {
                    return [
                        'user_id' => $approver['user_id'],
                        'order' => $approver['order'],
                        'user' => $users->get($approver['user_id']),
                    ];
                })
                ->toArray();

            return response()->json([
                'success' => true,
                'message' => 'Dispatch settings updated successfully',
                'data' => $settings,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error updating dispatch settings: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update dispatch settings',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get list of potential approvers (active users in company)
     */
    public function getPotentialApprovers(Request $request)
    {
        if (!$this->hasPermission($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view users.',
            ], 403);
        }

        $user = $request->user();
        
        $users = User::where('company_id', $user->company_id)
            ->where('is_active', true)
            ->select('id', 'first_name', 'last_name', 'email', 'role_id')
            ->with('role:id,name')
            ->orderBy('first_name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Potential approvers retrieved successfully',
            'data' => $users,
        ], 200);
    }
}
