<?php

namespace App\Http\Controllers;

use App\Models\DeliveryPerson;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\Logistic;

class DeliveryPersonController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Get all delivery persons.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user->role;

        try {
            $query = DeliveryPerson::with('company');

            // If user can manage system, show all delivery persons
            // Otherwise, filter by user's company
            if (!$role || !$role->hasPermission('can_manage_system')) {
                $query->where('company_id', $user->company_id);
            }

            // Optional: filter by company_id query parameter
            if ($request->has('company_id')) {
                $query->where('company_id', $request->input('company_id'));
            }

            // Optional: filter by active status
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $deliveryPersons = $query->orderBy('full_name')->get();

            return response()->json([
                'status' => 'success',
                'delivery_persons' => $deliveryPersons,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to fetch delivery persons', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch delivery persons: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a single delivery person by ID.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $role = $user->role;

        try {
            $deliveryPerson = DeliveryPerson::with('company')->find($id);

            if (!$deliveryPerson) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Delivery person not found.',
                ], 404);
            }

            // Check if user has access to this delivery person
            if (!$role || !$role->hasPermission('can_manage_system')) {
                if ($deliveryPerson->company_id !== $user->company_id) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to view this delivery person.',
                    ], 403);
                }
            }

            return response()->json([
                'status' => 'success',
                'delivery_person' => $deliveryPerson,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to fetch delivery person', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch delivery person: ' . $e->getMessage(),
            ], 500);
        }
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
     * Create a new delivery person.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // Format the phone number before validation
        // $phoneNumber = PhoneHelper::formatKenyanPhoneNumber($request->input('phone_number'));

        $validator = Validator::make(
            $request->all(),
            [
                'full_name' => 'required|string|max:100',
                'phone_number' => 'required|string|unique:delivery_persons,phone_number',
            ]
        );

        $phoneNumber = $request->input('phone_number');

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_delivery_persons', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create delivery persons.',
            ], 403);
        }

        try {
            return DB::transaction(function () use ($request, $user, $phoneNumber) {
                $deliveryPerson = DeliveryPerson::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $user->company_id,
                    'full_name' => $request->input('full_name'),
                    'phone_number' => $phoneNumber,
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Delivery person created successfully.',
                    'delivery_person' => $deliveryPerson->load('company'),
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create delivery person', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create delivery person: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing delivery person.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'sometimes|required|string|max:100',
            'phone_number' => 'sometimes|required|string|unique:delivery_persons,phone_number,' . $id . ',id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_delivery_persons', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update delivery persons.',
            ], 403);
        }
        $deliveryPerson = DeliveryPerson::find($id);
        if (!$deliveryPerson) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Delivery person not found.',
            ], 404);
        }

        try {
            return DB::transaction(function () use ($request, $deliveryPerson) {
                $deliveryPerson->update($request->only(['full_name', 'phone_number']));

                return response()->json([
                    'status' => 'success',
                    'message' => 'Delivery person updated successfully.',
                    'delivery_person' => $deliveryPerson->load('company'),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to update delivery person', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update delivery person: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Deactivate a delivery person.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function deactivate(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_deactivate_delivery_persons', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to deactivate delivery persons.',
            ], 403);
        }
        $deliveryPerson = DeliveryPerson::find($id);
        if (!$deliveryPerson) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Delivery person not found.',
            ], 404);
        }

        try {
            return DB::transaction(function () use ($deliveryPerson) {
                if (!$deliveryPerson->is_active) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Delivery person is already deactivated.',
                    ], 400);
                }

                $deliveryPerson->update(['is_active' => false]);

                // Unassign from active logistics entries
                Logistic::where('delivery_person_id', $deliveryPerson->id)
                    ->where('delivery_status', '!=', 'delivered')
                    ->update(['delivery_person_id' => null]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Delivery person deactivated successfully.',
                    'delivery_person' => $deliveryPerson->load('company'),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to deactivate delivery person', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to deactivate delivery person: ' . $e->getMessage(),
            ], 500);
        }
    }
}
