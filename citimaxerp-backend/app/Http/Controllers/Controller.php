<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /**
     * Check if user can manage a specific company
     * System admins can manage any company, company managers can only manage their own
     */
    protected function canManageCompany(Request $request, $companyId)
    {
        $user = $request->user();
        
        if (!$user) {
            return false;
        }

        $role = $user->role;
        
        if (!$role) {
            return false;
        }

        // System admin can manage any company
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }

        // Company manager can only manage their own company
        if ($role->hasPermission('can_manage_company')) {
            return $user->company_id === $companyId;
        }

        return false;
    }
}
