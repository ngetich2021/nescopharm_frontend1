<?php

namespace App\Http\Controllers;

use App\Models\DeliveryDetail;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class DeliveryDetailController extends Controller
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
        if (!$this->hasPermission($request, 'can_view_deliveries', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $query = DeliveryDetail::query();
        $query->where('company_id', $user->company_id);
        if ($request->filled('order_id')) {
            $query->where('order_id', $request->input('order_id'));
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->input('customer_id'));
        }
        return response()->json([
            'status' => 'success',
            'delivery_details' => $query->get(),
        ]);
    }

    public function show($id)
    {
        $detail = DeliveryDetail::find($id);
        if (!$detail) {
            return response()->json(['status' => 'failed', 'message' => 'Not found'], 404);
        }
        return response()->json(['status' => 'success', 'delivery_detail' => $detail]);
    }

    // Generate a unique tracking number for the company, similar to order number logic
    protected function generateTrackingNumber($companyId)
    {
        $prefix = 'TRK-' . strtoupper(substr($companyId, 0, 8)) . '-';
        $lastTracking = DeliveryDetail::where('company_id', $companyId)
            ->where('tracking_number', 'like', $prefix . '%')
            ->orderBy('tracking_number', 'desc')
            ->first();

        $nextNumber = $lastTracking ? (int)substr($lastTracking->tracking_number, strlen($prefix)) + 1 : 1;
        return strtoupper($prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_id' => 'required|uuid',
            'customer_id' => 'required|uuid',
            'order_id' => 'required|uuid',
            'delivery_location_id' => 'uuid',
            'delivery_person_id' => 'nullable|uuid|exists:delivery_people,id',
            'delivery_method' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:100',
            'estimated_delivery_date' => 'nullable|date',
            'actual_delivery_date' => 'nullable|date',
            'delivery_status' => 'nullable|string|max:50',
            'delivery_instructions' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }
        $data = $validator->validated();
        // Generate tracking number if not provided, using company-based sequence
        if (empty($data['tracking_number'])) {
            $data['tracking_number'] = $this->generateTrackingNumber($data['company_id']);
        } else {
            $data['tracking_number'] = strtoupper($data['tracking_number']);
        }
        $detail = DeliveryDetail::create(array_merge($data, ['id' => (string) Str::uuid()]));
        return response()->json([
            'status' => 'success',
            'message' => 'Delivery detail created successfully',
            'delivery_detail' => $detail
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $detail = DeliveryDetail::find($id);
        if (!$detail) {
            return response()->json(['status' => 'failed', 'message' => 'Not found'], 404);
        }
        $validator = Validator::make($request->all(), [
            'delivery_person_id' => 'nullable|uuid|exists:delivery_people,id',
            'delivery_method' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:100',
            'estimated_delivery_date' => 'nullable|date',
            'actual_delivery_date' => 'nullable|date',
            'delivery_status' => 'nullable|string|max:50',
            'delivery_instructions' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }
        $detail->update($validator->validated());
        return response()->json(['status' => 'success', 'delivery_detail' => $detail]);
    }

    public function updateStatus(Request $request, $id)
    {
        $detail = DeliveryDetail::find($id);
        if (!$detail) {
            return response()->json(['status' => 'failed', 'message' => 'Not found'], 404);
        }
        $validator = Validator::make($request->all(), [
            'delivery_status' => 'required|string|max:50',
            'actual_delivery_date' => 'nullable|date',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }
        $detail->delivery_status = $request->input('delivery_status');
        if ($request->filled('actual_delivery_date')) {
            $detail->actual_delivery_date = $request->input('actual_delivery_date');
        }
        $detail->save();
        return response()->json([
            'status' => 'success',
            'message' => 'Delivery status updated',
            'delivery_detail' => $detail
        ]);
    }

    protected function formatDeliveryAddress($location)
    {
        if (!$location) return null;
        $addressParts = [];
        if (!empty($location->house_number)) $addressParts[] = $location->house_number;
        if (!empty($location->street)) $addressParts[] = $location->street;
        if (!empty($location->estate)) $addressParts[] = $location->estate;
        if (!empty($location->city)) $addressParts[] = $location->city;
        if (!empty($location->country)) $addressParts[] = $location->country;
        if (!empty($location->landmark)) $addressParts[] = 'Near ' . $location->landmark;
        $address = implode(', ', $addressParts);
        if (!empty($location->location_note)) $address .= '. Note: ' . $location->location_note;
        return $address;
    }

    public function destroy($id)
    {
        $detail = DeliveryDetail::find($id);
        if (!$detail) {
            return response()->json(['status' => 'failed', 'message' => 'Not found'], 404);
        }
        $detail->delete();
        return response()->json(['status' => 'success', 'message' => 'Deleted successfully']);
    }
}
