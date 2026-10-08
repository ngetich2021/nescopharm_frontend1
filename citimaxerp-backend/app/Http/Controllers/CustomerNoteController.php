<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerNote;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CustomerNoteController extends Controller
{
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

    public function store(Request $request, string $customerId)
    {
        $request->validate([
            'note_content' => 'required|string|max:5000',
        ]);

        $user = $request->user();
        $customer = Customer::find($customerId);

        if (!$customer) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_customers', $customer->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized.',
            ], 403);
        }

        $note = CustomerNote::create([
            'id' => Str::uuid()->toString(),
            'customer_id' => $customerId,
            'company_id' => $customer->company_id,
            'note_content' => $request->note_content,
            'created_by' => $user->id,
        ]);

        $note->load('creator:id,first_name,last_name');

        return response()->json([
            'status' => 'success',
            'message' => 'Note added successfully.',
            'note' => $note,
        ], 201);
    }
}
