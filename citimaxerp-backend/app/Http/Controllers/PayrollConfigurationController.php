<?php

namespace App\Http\Controllers;

use App\Models\PayrollConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PayrollConfigurationController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, string $permission): bool
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company')) {
            return true;
        }
        return $role->hasPermission($permission);
    }

    /** List all configurations (newest first) + current active one. */
    public function index(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_payroll')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'status'         => 'success',
            'message'        => 'Payroll configurations retrieved.',
            'configurations' => PayrollConfiguration::orderByDesc('effective_from')->get(),
            'current'        => PayrollConfiguration::getCurrentConfig(),
        ]);
    }

    /** Show a single configuration record. */
    public function show(Request $request, int $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_payroll')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $config = PayrollConfiguration::find($id);
        if (!$config) {
            return response()->json(['status' => 'failed', 'message' => 'Configuration not found.'], 404);
        }

        return response()->json(['status' => 'success', 'configuration' => $config]);
    }

    /** Convenience endpoint — returns only the currently active config. */
    public function current(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_payroll')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $config = PayrollConfiguration::getCurrentConfig();
        if (!$config) {
            return response()->json([
                'status'        => 'warning',
                'message'       => 'No active payroll configuration found. System defaults are in use.',
                'configuration' => null,
            ]);
        }

        return response()->json(['status' => 'success', 'configuration' => $config]);
    }

    /** Create a new configuration record (versioning via effective_from / effective_to). */
    public function store(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_company')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'effective_from'  => 'required|date',
            'effective_to'    => 'nullable|date|after:effective_from',
            'personal_relief' => 'required|numeric|min:0',

            'tax_bands'             => 'required|array|min:1',
            'tax_bands.*.lower_limit' => 'required|numeric|min:0',
            'tax_bands.*.upper_limit' => 'nullable|numeric',
            'tax_bands.*.rate'        => 'required|numeric|min:0|max:1',

            'nssf_tiers'                  => 'required|array',
            'nssf_tiers.tier1.limit'      => 'required|numeric|min:0',
            'nssf_tiers.tier1.rate'       => 'required|numeric|min:0|max:1',
            'nssf_tiers.tier2.limit'      => 'required|numeric|min:0',
            'nssf_tiers.tier2.rate'       => 'required|numeric|min:0|max:1',

            'shif_rates'          => 'required|array',
            'shif_rates.standard' => 'required|numeric|min:0|max:1',
            'shif_rates.minimum'  => 'required|numeric|min:0',

            'minimum_wages' => 'required|array',

            'overtime_rates'                          => 'required|array',
            'overtime_rates.regular'                  => 'required|numeric|min:1',
            'overtime_rates.weekend'                  => 'required|numeric|min:1',
            'overtime_rates.holiday'                  => 'required|numeric|min:1',
            'overtime_rates.standard_monthly_hours'   => 'required|numeric|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $config = PayrollConfiguration::create($request->only([
            'effective_from', 'effective_to', 'personal_relief',
            'tax_bands', 'nssf_tiers', 'shif_rates', 'minimum_wages', 'overtime_rates',
        ]));

        return response()->json([
            'status'        => 'success',
            'message'       => 'Payroll configuration created successfully.',
            'configuration' => $config,
        ], 201);
    }

    /** Update an existing configuration record. */
    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_company')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $config = PayrollConfiguration::find($id);
        if (!$config) {
            return response()->json(['status' => 'failed', 'message' => 'Configuration not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'effective_from'  => 'sometimes|date',
            'effective_to'    => 'nullable|date|after:effective_from',
            'personal_relief' => 'sometimes|numeric|min:0',
            'tax_bands'       => 'sometimes|array|min:1',
            'nssf_tiers'      => 'sometimes|array',
            'shif_rates'      => 'sometimes|array',
            'minimum_wages'   => 'sometimes|array',
            'overtime_rates'  => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $config->update($request->only([
            'effective_from', 'effective_to', 'personal_relief',
            'tax_bands', 'nssf_tiers', 'shif_rates', 'minimum_wages', 'overtime_rates',
        ]));

        return response()->json([
            'status'        => 'success',
            'message'       => 'Payroll configuration updated successfully.',
            'configuration' => $config->fresh(),
        ]);
    }

    /** Delete a configuration record. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_company')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $config = PayrollConfiguration::find($id);
        if (!$config) {
            return response()->json(['status' => 'failed', 'message' => 'Configuration not found.'], 404);
        }

        $config->delete();

        return response()->json(['status' => 'success', 'message' => 'Configuration deleted successfully.']);
    }
}
