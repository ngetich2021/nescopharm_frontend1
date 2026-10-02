<?php

namespace App\Http\Controllers;

use App\Models\CompanyMpesaConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CompanyMpesaConfigController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum'); // Require authentication for all endpoints
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
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized'], 403);
        }
        $query = CompanyMpesaConfig::query();
        if ($request->filled('company_id')) {
            if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $request->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized'], 403);
            }
            $query->where('company_id', $request->company_id);
        }
        $configs = $query->orderBy('created_at', 'desc')->get();
        // Hide sensitive fields in response
        $configs->transform(function ($config) {
            unset($config['consumer_key'], $config['consumer_secret'], $config['passkey']);
            return $config;
        });
        return response()->json([
            'status' => 'success',
            'message' => "Configs fetched successfully",
            'data' => $configs
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $request->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized'], 403);
        }
        $request->validate([
            'company_id' => 'required|string|exists:companies,id',
            'paybill_number' => 'nullable|string',
            'till_number' => 'nullable|string',
            'shortcode' => 'nullable|string',
            'consumer_key' => 'nullable|string',
            'consumer_secret' => 'nullable|string',
            'passkey' => 'nullable|string',
            'callback_url' => 'nullable|string',
            'confirmation_url' => 'nullable|string',
            'validation_url' => 'nullable|string',
            'environment' => 'nullable|string|in:sandbox,production',
            'is_active' => 'nullable|boolean',
            'description' => 'nullable|string',
        ]);
        try {
            DB::beginTransaction();
            $config = CompanyMpesaConfig::create(array_merge(
                $request->only([
                    'company_id',
                    'paybill_number',
                    'till_number',
                    'shortcode',
                    'consumer_key',
                    'consumer_secret',
                    'passkey',
                    'callback_url',
                    'confirmation_url',
                    'validation_url',
                    'environment',
                    'is_active',
                    'description'
                ]),
                ['id' => (string) Str::uuid()]
            ));
            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => "Config created successfully",
                'data' => $config
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create Mpesa config', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $config = CompanyMpesaConfig::find($id);
        if (!$config) {
            return response()->json(['status' => 'failed', 'message' => 'Config not found'], 404);
        }
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $config->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized'], 403);
        }
        $request->validate([
            'paybill_number' => 'nullable|string',
            'till_number' => 'nullable|string',
            'shortcode' => 'nullable|string',
            'consumer_key' => 'nullable|string',
            'consumer_secret' => 'nullable|string',
            'passkey' => 'nullable|string',
            'callback_url' => 'nullable|string',
            'confirmation_url' => 'nullable|string',
            'validation_url' => 'nullable|string',
            'environment' => 'nullable|string|in:sandbox,production',
            'is_active' => 'nullable|boolean',
            'description' => 'nullable|string',
        ]);
        try {
            DB::beginTransaction();
            $config->update($request->only([
                'paybill_number',
                'till_number',
                'shortcode',
                'consumer_key',
                'consumer_secret',
                'passkey',
                'callback_url',
                'confirmation_url',
                'validation_url',
                'environment',
                'is_active',
                'description'
            ]));
            DB::commit();
            // Hide sensitive fields in response
            $config->makeHidden(['consumer_key', 'consumer_secret', 'passkey']);
            return response()->json([
                'status' => 'success',
                'message' => "Config fetched successfully",
                'data' => $config
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update Mpesa config', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $config = CompanyMpesaConfig::find($id);
        if (!$config) {
            return response()->json(['status' => 'failed', 'message' => 'Config not found'], 404);
        }
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $config->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized'], 403);
        }
        try {
            DB::beginTransaction();
            $config->delete();
            DB::commit();
            return response()->json(['status' => 'success', 'message' => 'Config deleted']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete Mpesa config', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }
}
