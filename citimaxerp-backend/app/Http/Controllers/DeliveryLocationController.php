<?php

namespace App\Http\Controllers;

use App\Models\DeliveryLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class DeliveryLocationController extends Controller
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

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_delivery_locations', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $query = DeliveryLocation::query();
        $query->where('company_id', $user->company_id);
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->input('customer_id'));
        }
        return response()->json([
            'status' => 'success',
            'delivery_locations' => $query->get(),
        ]);
    }

    public function customerLocations(Request $request, $customerId)
    {
        if (!$this->hasPermission($request, 'can_view_orders')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $user = $request->user();
        $query = DeliveryLocation::where('customer_id', $customerId);
        if (!$this->hasPermission($request, 'can_manage_all_quotes')) {
            $query->where('company_id', $user->company_id);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Delivery locations for customer',
            'delivery_locations' => $query->get(),
        ]);
    }

    public function show($id)
    {
        $location = DeliveryLocation::find($id);
        if (!$location) {
            return response()->json(['status' => 'failed', 'message' => 'Not found'], 404);
        }
        return response()->json(['status' => 'success', 'delivery_location' => $location]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_id' => 'required|uuid',
            'customer_id' => 'required|uuid',
            'house_number' => 'nullable|string|max:50',
            'estate' => 'nullable|string|max:100',
            'city' => 'nullable|string|max:100',
            'street' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'is_default' => 'sometimes|boolean',
            'location_note' => 'nullable|string|max:255',
            'landmark' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 'failed',
                    'message' => $validator->errors()
                ],
                400
            );
        }
        $location = DeliveryLocation::create(array_merge($validator->validated(), ['id' => (string) Str::uuid()]));
        return response()->json([
            'status' => 'success',
            'delivery_location' => $location
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $location = DeliveryLocation::find($id);
        if (!$location) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Delivery location not found'
            ], 404);
        }
        $validator = Validator::make($request->all(), [
            'house_number' => 'nullable|string|max:50',
            'estate' => 'nullable|string|max:100',
            'city' => 'nullable|string|max:100',
            'street' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'is_default' => 'sometimes|boolean',
            'location_note' => 'nullable|string|max:255',
            'landmark' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }
        $location->update($validator->validated());
        return response()->json([
            'status' => 'success',
            'message' => 'Delivery location updated successfully',
            'delivery_location' => $location
        ]);
    }

    public function destroy($id)
    {
        $location = DeliveryLocation::find($id);
        if (!$location) {
            return response()->json(['status' => 'failed', 'message' => 'Not found'], 404);
        }
        $location->delete();
        return response()->json(['status' => 'success', 'message' => 'Deleted successfully']);
    }
}
