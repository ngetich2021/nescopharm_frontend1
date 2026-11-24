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
        foreach (['assigned_to', 'location', 'status'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->input($field));
            }
        }

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                foreach (['name', 'category', 'serial_number', 'location', 'asset_code', 'tag_number', 'assigned_to', 'supplier', 'invoice_number'] as $col) {
                    $q->orWhere($col, 'ilike', "%{$term}%");
                }
            });
        }

        // Depreciation and net book value as at a date (today by default), for each asset.
        $asAt = $request->input('as_at');
        $assets = $query->orderByRaw('asset_code IS NULL, asset_code')->orderBy('name')->get()
            ->map(fn (Asset $a) => $a->withDepreciation($asAt))->values();
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
            'data' => $asset->withDepreciation($request->input('as_at'))
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
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors(), 'data' => null], 400);
        }
        $data = $validator->validated();
        if ($clash = $this->codeClash($user->company_id, $data['asset_code'] ?? null)) {
            return response()->json(['status' => 'failed', 'message' => $clash, 'data' => null], 400);
        }
        // A new asset gets the next ID in its class (FUR-038...) when none is typed.
        $data['asset_code'] = ($data['asset_code'] ?? null) ?: Asset::nextCode($user->company_id, $data['category'] ?? null);

        $asset = Asset::create(array_merge($data, [
            'company_id' => $user->company_id,
        ]));

        return response()->json([
            'status' => 'success',
            'message' => 'Asset created successfully.',
            'data' => $asset->fresh()->withDepreciation()
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
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors(), 'data' => null], 400);
        }
        $data = $validator->validated();
        if ($clash = $this->codeClash($asset->company_id, $data['asset_code'] ?? null, $asset->id)) {
            return response()->json(['status' => 'failed', 'message' => $clash, 'data' => null], 400);
        }

        $asset->update($data);
        return response()->json([
            'status' => 'success',
            'message' => 'Asset updated successfully.',
            'data' => $asset->fresh()->withDepreciation()
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
        $asAt = $request->input('as_at');
        $rows = Asset::forCompany($user->company_id)->get()->map(fn (Asset $a) => $a->withDepreciation($asAt));
        // Per class, as the register's Summary sheet: lines, pieces, cost, depreciation, net book value.
        $byClass = $rows->groupBy(fn ($r) => $r['category'] ?: 'Unclassified')->map(fn ($g, $class) => [
            'class' => $class,
            'lines' => $g->count(),
            'quantity' => (int) $g->sum('quantity'),
            'total_cost' => round($g->sum('total_cost'), 2),
            'rate' => Asset::CLASSES[$class]['rate'] ?? null,
            'useful_life_years' => Asset::CLASSES[$class]['life'] ?? null,
            'annual_depreciation' => round($g->sum('annual_depreciation'), 2),
            'accumulated_depreciation' => round($g->sum('accumulated_depreciation'), 2),
            'net_book_value' => round($g->sum('net_book_value'), 2),
        ])->values();
        return response()->json([
            'status' => 'success',
            'message' => 'Asset summary retrieved successfully.',
            'data' => [
                'totalAssets' => $rows->count(),
                'totalQuantity' => (int) $rows->sum('quantity'),
                'totalValue' => round($rows->sum('total_cost'), 2),
                'totalCategories' => $rows->pluck('category')->filter()->unique()->count(),
                'accumulatedDepreciation' => round($rows->sum('accumulated_depreciation'), 2),
                'netBookValue' => round($rows->sum('net_book_value'), 2),
                'annualDepreciation' => round($rows->sum('annual_depreciation'), 2),
                'unassigned' => $rows->filter(fn ($r) => !self::isAssigned($r['assigned_to'] ?? null))->count(),
                'byClass' => $byClass,
                'asAt' => $asAt ? \Carbon\Carbon::parse($asAt)->toDateString() : now()->toDateString(),
            ]
        ]);
    }

    /**
     * Depreciation Schedule by asset - year-end projection, as the register's Schedule sheet: for each
     * year-end (31/12 from the first year-end, rolling 12 months) the accumulated depreciation, the
     * charge for the year and the net book value. Depreciation stops once an asset is fully depreciated.
     * ?first_year_end=2025-12-31&years=6 (defaults: 31/12 of the commencement year, 6 years)
     */
    public function schedule(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_assets', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view assets.', 'data' => null], 403);
        }
        $first = $request->filled('first_year_end')
            ? \Carbon\Carbon::parse($request->input('first_year_end'))->endOfDay()
            : \Carbon\Carbon::parse(Asset::COMMENCEMENT_DATE)->endOfYear();
        $years = max(1, min(15, (int) $request->input('years', 6)));
        $yearEnds = collect(range(0, $years - 1))->map(fn ($i) => $first->copy()->addMonthsNoOverflow(12 * $i)->endOfMonth()->toDateString())->all();

        $query = Asset::forCompany($user->company_id);
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }
        $assets = $query->orderByRaw('asset_code IS NULL, asset_code')->orderBy('name')->get();

        $totals = array_fill_keys($yearEnds, ['accumulated' => 0.0, 'charge' => 0.0, 'nbv' => 0.0]);
        $rows = $assets->map(function (Asset $a) use ($yearEnds, $first, &$totals) {
            $base = $a->depreciationAsAt($yearEnds[0]);
            $prevAcc = (float) $a->depreciationAsAt($first->copy()->subYear()->toDateString())['accumulated_depreciation'];
            $cols = [];
            foreach ($yearEnds as $ye) {
                $d = $a->depreciationAsAt($ye);
                $acc = round((float) $d['accumulated_depreciation'], 2);
                $charge = round($acc - $prevAcc, 2);
                // Not yet bought at this year-end: no book value yet.
                $bought = !$a->depreciation_start_date || \Carbon\Carbon::parse($a->depreciation_start_date)->lte($ye);
                $nbv = $bought ? round((float) $d['net_book_value'], 2) : 0.0;
                $cols[] = ['year_end' => $ye, 'accumulated' => $acc, 'charge' => $charge, 'nbv' => $nbv];
                $totals[$ye]['accumulated'] += $acc;
                $totals[$ye]['charge'] += $charge;
                $totals[$ye]['nbv'] += $nbv;
                $prevAcc = $acc;
            }
            return [
                'id' => $a->id,
                'asset_code' => $a->asset_code,
                'name' => $a->name,
                'category' => $a->category,
                'purchase_date' => $a->purchase_date ? \Carbon\Carbon::parse($a->purchase_date)->toDateString() : null,
                'total_cost' => (float) $base['total_cost'],
                'depreciation_start_date' => $a->depreciation_start_date ? \Carbon\Carbon::parse($a->depreciation_start_date)->toDateString() : null,
                'depreciable_amount' => (float) $base['depreciable_amount'],
                'monthly_depreciation' => (float) $base['monthly_depreciation'],
                'life_months' => (int) round(((float) $a->useful_life_years) * 12),
                'status' => $a->status,
                'years' => $cols,
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Depreciation schedule retrieved successfully.',
            'data' => [
                'year_ends' => $yearEnds,
                'rows' => $rows,
                'totals' => [
                    'total_cost' => round($rows->sum('total_cost'), 2),
                    'depreciable_amount' => round($rows->sum('depreciable_amount'), 2),
                    'monthly_depreciation' => round($rows->sum('monthly_depreciation'), 2),
                    'years' => collect($totals)->map(fn ($t, $ye) => [
                        'year_end' => $ye,
                        'accumulated' => round($t['accumulated'], 2),
                        'charge' => round($t['charge'], 2),
                        'nbv' => round($t['nbv'], 2),
                    ])->values(),
                ],
            ],
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

        $result = $this->importRows($user->company_id, $rows, $dryRun);

        return response()->json([
            'status' => 'success',
            'message' => $dryRun ? 'Import preview ready.' : 'Assets imported successfully.',
            'summary' => $result['summary'],
            'rows' => $result['rows'],
        ]);
    }

    /**
     * Rows from the register sheet (or the older plain template). A row with an Asset ID that is
     * already in the system updates that asset; otherwise the same asset (name, serial, location,
     * quantity, cost) is left alone, and anything else is added.
     */
    public function importRows(string $companyId, array $rows, bool $dryRun): array
    {
        $results = [];
        $summary = ['rows' => count($rows), 'created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0];
        $fields = ['name', 'category', 'serial_number', 'location', 'notes', 'asset_code', 'tag_number', 'assigned_to', 'supplier',
            'invoice_number', 'date_basis', 'depreciation_method', 'status', 'original_category'];
        $numbers = ['purchase_cost', 'total_cost', 'depreciation_rate', 'useful_life_years', 'residual_percent'];
        $dates = ['purchase_date', 'depreciation_start_date'];

        DB::beginTransaction();
        try {
            foreach ($rows as $i => $row) {
                $rowNo = $i + 1;
                $name = trim((string) ($row['name'] ?? ''));
                if ($name === '') {
                    $summary['errors']++;
                    $results[] = ['row' => $rowNo, 'name' => '', 'status' => 'error', 'message' => 'Asset Description is required'];
                    continue;
                }
                $data = ['name' => $name, 'quantity' => max(1, (int) ($row['quantity'] ?? 1))];
                foreach ($fields as $f) {
                    if (array_key_exists($f, $row)) {
                        $v = trim((string) $row[$f]);
                        $data[$f] = $v === '' ? null : $v;
                    }
                }
                foreach ($numbers as $f) {
                    if (isset($row[$f]) && $row[$f] !== '') {
                        $n = is_numeric($row[$f]) ? (float) $row[$f] : (float) preg_replace('/[^0-9.\-]/', '', (string) $row[$f]);
                        // The register writes rates as fractions (0.125 = 12.5%).
                        if (in_array($f, ['depreciation_rate', 'residual_percent'], true) && $n > 0 && $n <= 1) {
                            $n *= 100;
                        }
                        $data[$f] = $n;
                    }
                }
                foreach ($dates as $f) {
                    if (!empty($row[$f])) {
                        try {
                            $data[$f] = \Carbon\Carbon::parse($row[$f])->toDateString();
                        } catch (\Throwable $e) {
                            $summary['errors']++;
                            $results[] = ['row' => $rowNo, 'name' => $name, 'status' => 'error', 'message' => "Could not read the date \"{$row[$f]}\"."];
                            continue 2;
                        }
                    }
                }
                if (isset($data['depreciation_method'])) {
                    $data['depreciation_method'] = str_contains(strtolower($data['depreciation_method']), 'straight') ? 'straight_line' : $data['depreciation_method'];
                }
                if (isset($data['total_cost']) && !isset($data['purchase_cost'])) {
                    $data['purchase_cost'] = round($data['total_cost'] / $data['quantity'], 2);
                }

                $existing = !empty($data['asset_code'])
                    ? Asset::where('company_id', $companyId)->where('asset_code', $data['asset_code'])->first()
                    : null;
                if (!$existing && empty($data['asset_code'])) {
                    $same = Asset::where('company_id', $companyId)->whereRaw('lower(trim(name)) = ?', [mb_strtolower($name)])
                        ->where('serial_number', $data['serial_number'] ?? null)->where('location', $data['location'] ?? null)
                        ->where('quantity', $data['quantity'])
                        ->whereRaw('round(purchase_cost::numeric, 2) = ?', [round((float) ($data['purchase_cost'] ?? 0), 2)])->exists();
                    if ($same) {
                        $summary['unchanged']++;
                        $results[] = ['row' => $rowNo, 'name' => $name, 'status' => 'unchanged', 'message' => 'Already in the register - skipped.'];
                        continue;
                    }
                }

                if ($existing) {
                    $existing->fill($data);
                    if (!$existing->isDirty()) {
                        $summary['unchanged']++;
                        $results[] = ['row' => $rowNo, 'name' => $name, 'status' => 'unchanged', 'message' => "{$existing->asset_code} already matches."];
                        continue;
                    }
                    $changed = implode(', ', array_keys($existing->getDirty()));
                    if (!$dryRun) {
                        $existing->save();
                    }
                    $summary['updated']++;
                    $results[] = ['row' => $rowNo, 'name' => $name, 'status' => 'updated', 'message' => "{$existing->asset_code}: {$changed}"];
                    continue;
                }

                $data['asset_code'] = $data['asset_code'] ?? Asset::nextCode($companyId, $data['category'] ?? null);
                if (!$dryRun) {
                    Asset::create($data + ['company_id' => $companyId, 'is_active' => true]);
                }
                $summary['created']++;
                $results[] = ['row' => $rowNo, 'name' => $name, 'status' => 'created', 'message' => $data['asset_code']];
            }
            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Failed to import assets', ['error' => $e->getMessage()]);
            throw $e;
        }

        return ['summary' => $summary, 'rows' => $results];
    }

    private static function isAssigned(?string $who): bool
    {
        $w = strtolower(trim((string) $who));
        return $w !== '' && !in_array($w, ['n/a', 'na', 'not assigned', 'unassigned', '-'], true);
    }

    /** An Asset ID belongs to one asset only. */
    private function codeClash(string $companyId, ?string $code, ?string $exceptId = null): ?string
    {
        if (!$code) {
            return null;
        }
        $other = Asset::where('company_id', $companyId)->where('asset_code', $code)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))->first();
        return $other ? "Asset ID {$code} is already used by \"{$other->name}\"." : null;
    }

    private const OPTION_TYPES = ['category', 'department', 'assignee'];

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
        $result = ['category' => array_keys(Asset::CLASSES), 'department' => [], 'assignee' => []];
        foreach (AssetOption::forCompany($user->company_id)->get(['type', 'name']) as $opt) {
            $result[$opt->type][] = $opt->name;
        }
        $usedCategories = Asset::forCompany($user->company_id)->whereNotNull('category')->distinct()->pluck('category')->filter()->all();
        $usedDepartments = Asset::forCompany($user->company_id)->whereNotNull('location')->distinct()->pluck('location')->filter()->all();
        $usedAssignees = Asset::forCompany($user->company_id)->whereNotNull('assigned_to')->distinct()->pluck('assigned_to')
            ->filter(fn ($w) => self::isAssigned($w))->all();
        $result['category'] = array_values(array_unique(array_merge($result['category'], $usedCategories)));
        $result['department'] = array_values(array_unique(array_merge($result['department'], $usedDepartments)));
        $result['assignee'] = array_values(array_unique(array_merge($result['assignee'], $usedAssignees)));
        sort($result['category']);
        sort($result['department']);
        sort($result['assignee']);

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
            'type' => 'required|string|in:category,department,assignee',
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
            'total_cost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'asset_code' => 'nullable|string|max:30',
            'tag_number' => 'nullable|string|max:30',
            'assigned_to' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'invoice_number' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'date_basis' => 'nullable|string|max:60',
            'depreciation_method' => 'nullable|string|max:30',
            'depreciation_rate' => 'nullable|numeric|min:0|max:100',
            'useful_life_years' => 'nullable|numeric|min:0|max:100',
            'residual_percent' => 'nullable|numeric|min:0|max:100',
            'depreciation_start_date' => 'nullable|date',
            'status' => 'nullable|string|max:30',
            'original_category' => 'nullable|string|max:255',
        ];
    }
}
