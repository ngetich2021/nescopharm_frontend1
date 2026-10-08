<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetOption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AssetController extends Controller
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
        if (!$this->hasPermission($request, 'can_view_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view assets.', 'data' => null], 403);
        }

        $query = Asset::forCompany($user->company_id);

        if ($request->has('is_active')) {
            $bool = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($bool !== null) {
                $query->where('is_active', $bool);
            }
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', "%{$term}%")
                    ->orWhere('category', 'ilike', "%{$term}%")
                    ->orWhere('serial_number', 'ilike', "%{$term}%")
                    ->orWhere('location', 'ilike', "%{$term}%");
            });
        }

        $assets = $query->orderByDesc('created_at')->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Assets retrieved successfully.',
            'data' => $assets
        ]);
    }

    public function show(Request $request, $id)
    {
        $asset = Asset::find($id);
        if (!$asset) {
            return response()->json(['status' => 'failed', 'message' => 'Asset not found.', 'data' => null], 404);
        }
        if (!$this->hasPermission($request, 'can_view_assets', $asset->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view asset.', 'data' => null], 403);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Asset retrieved successfully.',
            'data' => $asset
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create assets.', 'data' => null], 403);
        }

        $validator = Validator::make($request->all(), $this->rules());
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'data' => null], 400);
        }

        $asset = Asset::create(array_merge($validator->validated(), [
            'company_id' => $user->company_id,
        ]));

        return response()->json([
            'status' => 'success',
            'message' => 'Asset created successfully.',
            'data' => $asset
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $asset = Asset::find($id);
        if (!$asset) {
            return response()->json(['status' => 'failed', 'message' => 'Asset not found.', 'data' => null], 404);
        }
        if (!$this->hasPermission($request, 'can_update_assets', $asset->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update asset.', 'data' => null], 403);
        }

        $validator = Validator::make($request->all(), $this->rules(true));
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'data' => null], 400);
        }

        $asset->update($validator->validated());
        return response()->json([
            'status' => 'success',
            'message' => 'Asset updated successfully.',
            'data' => $asset
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $asset = Asset::find($id);
        if (!$asset) {
            return response()->json(['status' => 'failed', 'message' => 'Asset not found.', 'data' => null], 404);
        }
        if (!$this->hasPermission($request, 'can_delete_assets', $asset->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete assets.', 'data' => null], 403);
        }
        $asset->delete();
        return response()->json(['status' => 'success', 'message' => 'Asset deleted.', 'data' => null]);
    }

    public function summary(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view assets.', 'data' => null], 403);
        }
        $assets = Asset::forCompany($user->company_id)->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Asset summary retrieved successfully.',
            'data' => [
                'totalAssets' => $assets->count(),
                'totalQuantity' => (int) $assets->sum('quantity'),
                'totalValue' => (float) $assets->sum(fn ($a) => (float) $a->purchase_cost * (int) $a->quantity),
                'totalCategories' => $assets->whereNotNull('category')->pluck('category')->unique()->count(),
            ]
        ]);
    }

    /**
     * Bulk import assets from parsed spreadsheet rows. With dry_run truthy the
     * rows are validated and a per-row summary is returned without persisting;
     * otherwise valid rows are inserted and invalid rows are skipped.
     */
    public function import(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to import assets.', 'data' => null], 403);
        }

        $rows = $request->input('rows', []);
        $dryRun = filter_var($request->input('dry_run', true), FILTER_VALIDATE_BOOLEAN);

        if (!is_array($rows) || count($rows) === 0) {
            return response()->json(['status' => 'failed', 'message' => 'No rows to import.', 'data' => null], 400);
        }

        $results = [];
        $created = 0;
        $errors = 0;
        $toInsert = [];

        foreach ($rows as $i => $row) {
            $rowNo = $i + 1;
            $name = trim((string) ($row['name'] ?? ''));

            if ($name === '') {
                $errors++;
                $results[] = ['row' => $rowNo, 'name' => '', 'status' => 'error', 'message' => 'Asset Name/Description is required'];
                continue;
            }

            $quantity = (int) ($row['quantity'] ?? 1);
            if ($quantity < 1) {
                $quantity = 1;
            }
            $cost = $row['purchase_cost'] ?? 0;
            $cost = is_numeric($cost) ? (float) $cost : (float) preg_replace('/[^0-9.]/', '', (string) $cost);

            $created++;
            $results[] = ['row' => $rowNo, 'name' => $name, 'status' => 'created', 'message' => null];

            if (!$dryRun) {
                $toInsert[] = [
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'company_id' => $user->company_id,
                    'name' => $name,
                    'category' => trim((string) ($row['category'] ?? '')) ?: null,
                    'serial_number' => trim((string) ($row['serial_number'] ?? '')) ?: null,
                    'location' => trim((string) ($row['location'] ?? '')) ?: null,
                    'quantity' => $quantity,
                    'purchase_cost' => $cost,
                    'is_active' => 'true',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        if (!$dryRun && count($toInsert) > 0) {
            try {
                DB::transaction(function () use ($toInsert) {
                    foreach (array_chunk($toInsert, 500) as $chunk) {
                        Asset::insert($chunk);
                    }
                });
            } catch (\Exception $e) {
                Log::error('Failed to import assets', ['error' => $e->getMessage()]);
                return response()->json(['status' => 'failed', 'message' => 'Failed to import assets: ' . $e->getMessage(), 'data' => null], 500);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => $dryRun ? 'Import preview ready.' : 'Assets imported successfully.',
            'summary' => [
                'rows' => count($rows),
                'created' => $created,
                'updated' => 0,
                'unchanged' => 0,
                'errors' => $errors,
            ],
            'rows' => $results,
        ]);
    }

    private const OPTION_TYPES = ['category', 'department'];

    public function options(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view asset options.', 'data' => null], 403);
        }

        $type = $request->input('type');
        $onlyType = in_array($type, self::OPTION_TYPES, true) ? $type : null;

        // Merge in distinct values already recorded on assets so imported data
        // shows up in the pickers without needing to be re-added manually.
        $result = ['category' => [], 'department' => []];
        foreach (AssetOption::forCompany($user->company_id)->get(['type', 'name']) as $opt) {
            $result[$opt->type][] = $opt->name;
        }
        $usedCategories = Asset::forCompany($user->company_id)->whereNotNull('category')->distinct()->pluck('category')->filter()->all();
        $usedDepartments = Asset::forCompany($user->company_id)->whereNotNull('location')->distinct()->pluck('location')->filter()->all();
        $result['category'] = array_values(array_unique(array_merge($result['category'], $usedCategories)));
        $result['department'] = array_values(array_unique(array_merge($result['department'], $usedDepartments)));
        sort($result['category']);
        sort($result['department']);

        $data = $onlyType ? $result[$onlyType] : $result;
        return response()->json([
            'status' => 'success',
            'message' => 'Asset options retrieved successfully.',
            'data' => $data,
        ]);
    }

    public function storeOption(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to add asset options.', 'data' => null], 403);
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|string|in:category,department',
            'name' => 'required|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'data' => null], 400);
        }

        $name = trim($request->input('name'));
        $option = AssetOption::firstOrCreate([
            'company_id' => $user->company_id,
            'type' => $request->input('type'),
            'name' => $name,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Asset option saved.',
            'data' => $option,
        ], 201);
    }

    protected function rules(bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';
        return [
            'name' => "$required|string|max:255",
            'category' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'quantity' => 'nullable|integer|min:1',
            'purchase_cost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ];
    }
}
