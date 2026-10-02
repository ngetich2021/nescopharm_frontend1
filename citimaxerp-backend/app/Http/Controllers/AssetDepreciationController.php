<?php

namespace App\Http\Controllers;

use App\Models\AssetDepreciation;
use App\Models\FixedAsset;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\ChartOfAccount;
use App\Models\FinancialPeriod;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class AssetDepreciationController extends Controller
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

    /**
     * Display a listing of asset depreciation records.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view asset depreciations.'], 403);
        }
        $query = AssetDepreciation::with(['fixedAsset']);
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $companyId);
        }
        // ...existing code...
        if ($request->has('asset_id')) {
            $query->where('fixed_asset_id', $request->asset_id);
        }
        if ($request->has('period_start') && $request->has('period_end')) {
            $query->whereBetween('depreciation_date', [$request->period_start, $request->period_end]);
        }
        if ($request->has('depreciation_method')) {
            $query->where('depreciation_method', $request->depreciation_method);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        $depreciations = $query->orderBy('depreciation_date', 'desc')
            ->paginate($request->get('per_page', 15));
        return response()->json($depreciations);
    }

    /**
     * Store a newly created asset depreciation record.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create asset depreciation.'], 403);
        }
        $validator = Validator::make($request->all(), [
            'asset_id' => 'required|exists:fixed_assets,id',
            'depreciation_date' => 'required|date',
            'depreciation_amount' => 'required|numeric|min:0.01',
            'depreciation_method' => 'required|in:straight_line,declining_balance,units_of_production',
            'accumulated_depreciation_before' => 'required|numeric|min:0',
            'book_value_before' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'reference' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }
        try {
            DB::beginTransaction();

            $asset = FixedAsset::findOrFail($request->asset_id);

            $depreciation = AssetDepreciation::create([
                'fixed_asset_id' => $request->asset_id,
                'depreciation_date' => $request->depreciation_date,
                'depreciation_amount' => $request->depreciation_amount,
                'depreciation_method' => $request->depreciation_method,
                'accumulated_depreciation_before' => $request->accumulated_depreciation_before,
                'accumulated_depreciation_after' => $request->accumulated_depreciation_before + $request->depreciation_amount,
                'book_value_before' => $request->book_value_before,
                'book_value_after' => $request->book_value_before - $request->depreciation_amount,
                'description' => $request->description,
                'reference' => $request->reference,
                'status' => 'posted',
                'company_id' => auth()->user()->company_id,
                'created_by' => auth()->id(),
            ]);

            // Update the fixed asset with new depreciation values
            $asset->update([
                'accumulated_depreciation' => $depreciation->accumulated_depreciation_after,
                'current_value' => $depreciation->book_value_after,
            ]);

            // Create journal entry for depreciation
            $this->createDepreciationJournalEntry($depreciation, $asset);

            DB::commit();

            return response()->json([
                'message' => 'Asset depreciation record created successfully',
                'data' => $depreciation->load('fixedAsset')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create depreciation record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified asset depreciation record.
     */
    public function show(string $id): JsonResponse
    {
        $depreciation = AssetDepreciation::with(['fixedAsset', 'journalEntries'])
            ->findOrFail($id);

        return response()->json($depreciation);
    }

    /**
     * Update the specified asset depreciation record.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $depreciation = AssetDepreciation::findOrFail($id);

        if ($depreciation->status === 'posted') {
            return response()->json(['message' => 'Cannot update posted depreciation record'], 400);
        }

        $validator = Validator::make($request->all(), [
            'depreciation_date' => 'sometimes|date',
            'depreciation_amount' => 'sometimes|numeric|min:0.01',
            'description' => 'nullable|string',
            'reference' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $oldAmount = $depreciation->depreciation_amount;

            $depreciation->update($request->only([
                'depreciation_date',
                'depreciation_amount',
                'description',
                'reference'
            ]));

            // Recalculate accumulated depreciation and book value if amount changed
            if ($request->has('depreciation_amount')) {
                $depreciation->accumulated_depreciation_after = $depreciation->accumulated_depreciation_before + $depreciation->depreciation_amount;
                $depreciation->book_value_after = $depreciation->book_value_before - $depreciation->depreciation_amount;
                $depreciation->save();

                // Update the fixed asset
                $asset = $depreciation->fixedAsset;
                $depreciationDiff = $depreciation->depreciation_amount - $oldAmount;

                $asset->update([
                    'accumulated_depreciation' => $asset->accumulated_depreciation + $depreciationDiff,
                    'current_value' => $asset->current_value - $depreciationDiff,
                ]);

                // Update journal entry if amount changed
                $this->updateDepreciationJournalEntry($depreciation);
            }

            DB::commit();

            return response()->json([
                'message' => 'Asset depreciation record updated successfully',
                'data' => $depreciation->load('fixedAsset')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update depreciation record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified asset depreciation record.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $depreciation = AssetDepreciation::findOrFail($id);

            if ($depreciation->status === 'posted') {
                return response()->json(['message' => 'Cannot delete posted depreciation record'], 400);
            }

            DB::beginTransaction();

            // Reverse the depreciation in the fixed asset
            $asset = $depreciation->fixedAsset;
            $asset->update([
                'accumulated_depreciation' => $asset->accumulated_depreciation - $depreciation->depreciation_amount,
                'current_value' => $asset->current_value + $depreciation->depreciation_amount,
            ]);

            // Delete related journal entries
            $depreciation->journalEntries()->delete();
            $depreciation->delete();

            DB::commit();

            return response()->json(['message' => 'Asset depreciation record deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete depreciation record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Calculate depreciation for multiple assets.
     */
    public function calculateBulkDepreciation(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'depreciation_date' => 'required|date',
            'asset_ids' => 'array',
            'asset_ids.*' => 'exists:fixed_assets,id',
            'depreciation_method' => 'required|in:straight_line,declining_balance,units_of_production',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $depreciationDate = $request->depreciation_date;
            $method = $request->depreciation_method;

            // Get assets to depreciate
            $query = FixedAsset::where('status', 'active')
                ->where('current_value', '>', 0);

            if ($request->has('asset_ids')) {
                $query->whereIn('id', $request->asset_ids);
            }

            $assets = $query->get();
            $createdDepreciations = [];

            foreach ($assets as $asset) {
                // Check if depreciation already exists for this period
                $existingDepreciation = AssetDepreciation::where('fixed_asset_id', $asset->id)
                    ->whereMonth('depreciation_date', now()->parse($depreciationDate)->month)
                    ->whereYear('depreciation_date', now()->parse($depreciationDate)->year)
                    ->first();

                if ($existingDepreciation) {
                    continue; // Skip if already depreciated for this period
                }

                $depreciationAmount = $this->calculateDepreciationAmount($asset, $method);

                if ($depreciationAmount > 0) {
                    $depreciation = AssetDepreciation::create([
                        'fixed_asset_id' => $asset->id,
                        'depreciation_date' => $depreciationDate,
                        'depreciation_amount' => $depreciationAmount,
                        'depreciation_method' => $method,
                        'accumulated_depreciation_before' => $asset->accumulated_depreciation,
                        'accumulated_depreciation_after' => $asset->accumulated_depreciation + $depreciationAmount,
                        'book_value_before' => $asset->current_value,
                        'book_value_after' => $asset->current_value - $depreciationAmount,
                        'description' => "Monthly depreciation - {$method}",
                        'status' => 'posted',
                        'company_id' => auth()->user()->company_id,
                        'created_by' => auth()->id(),
                    ]);

                    // Update asset values
                    $asset->update([
                        'accumulated_depreciation' => $depreciation->accumulated_depreciation_after,
                        'current_value' => $depreciation->book_value_after,
                    ]);

                    // Create journal entry
                    $this->createDepreciationJournalEntry($depreciation, $asset);

                    $createdDepreciations[] = $depreciation->load('fixedAsset');
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Bulk depreciation calculated successfully',
                'data' => $createdDepreciations,
                'summary' => [
                    'total_assets' => count($createdDepreciations),
                    'total_depreciation' => collect($createdDepreciations)->sum('depreciation_amount'),
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to calculate bulk depreciation', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get depreciation schedule for an asset.
     */
    public function getDepreciationSchedule(string $assetId): JsonResponse
    {
        $asset = FixedAsset::findOrFail($assetId);

        $depreciations = AssetDepreciation::where('fixed_asset_id', $assetId)
            ->orderBy('depreciation_date', 'asc')
            ->get();

        $schedule = [];
        $runningDepreciation = 0;
        $runningBookValue = $asset->original_cost;

        // Calculate future depreciation schedule
        $remainingValue = $asset->current_value - $asset->salvage_value;
        $remainingLife = max(0, $asset->useful_life_months - $depreciations->count());

        if ($remainingLife > 0 && $remainingValue > 0) {
            $monthlyDepreciation = $remainingValue / $remainingLife;
            $currentDate = now()->startOfMonth();

            for ($i = 0; $i < $remainingLife; $i++) {
                $depreciationAmount = min($monthlyDepreciation, $runningBookValue - $asset->salvage_value);

                if ($depreciationAmount <= 0) break;

                $schedule[] = [
                    'period' => $currentDate->copy()->addMonths($i)->format('Y-m'),
                    'depreciation_amount' => round($depreciationAmount, 2),
                    'accumulated_depreciation' => round($asset->accumulated_depreciation + (($i + 1) * $depreciationAmount), 2),
                    'book_value' => round($asset->current_value - (($i + 1) * $depreciationAmount), 2),
                    'is_projected' => true,
                ];
            }
        }

        return response()->json([
            'asset' => $asset,
            'historical_depreciations' => $depreciations,
            'projected_schedule' => $schedule,
            'summary' => [
                'total_historical_depreciation' => $depreciations->sum('depreciation_amount'),
                'remaining_depreciable_value' => $remainingValue,
                'remaining_useful_life_months' => $remainingLife,
            ]
        ]);
    }

    /**
     * Get depreciation summary report.
     */
    public function getSummaryReport(Request $request): JsonResponse
    {
        $startDate = $request->get('start_date', now()->startOfYear());
        $endDate = $request->get('end_date', now()->endOfYear());

        $summary = AssetDepreciation::whereBetween('depreciation_date', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_entries,
                SUM(depreciation_amount) as total_depreciation,
                AVG(depreciation_amount) as average_depreciation,
                COUNT(DISTINCT fixed_asset_id) as assets_depreciated,
                depreciation_method,
                YEAR(depreciation_date) as year,
                MONTH(depreciation_date) as month
            ')
            ->groupBy('depreciation_method', 'year', 'month')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get();

        // Get assets requiring depreciation
        $assetsRequiringDepreciation = FixedAsset::where('status', 'active')
            ->where('current_value', '>', 0)
            ->whereDoesntHave('depreciations', function ($query) {
                $query->whereMonth('depreciation_date', now()->month)
                    ->whereYear('depreciation_date', now()->year);
            })
            ->count();

        return response()->json([
            'summary' => $summary,
            'assets_requiring_depreciation' => $assetsRequiringDepreciation,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ]
        ]);
    }

    /**
     * Calculate depreciation amount for an asset based on method.
     */
    private function calculateDepreciationAmount(FixedAsset $asset, string $method): float
    {
        switch ($method) {
            case 'straight_line':
                $depreciableAmount = $asset->original_cost - $asset->salvage_value;
                return $asset->useful_life_months > 0 ? $depreciableAmount / $asset->useful_life_months : 0;

            case 'declining_balance':
                $rate = 2 / $asset->useful_life_months; // Double declining balance
                return $asset->current_value * $rate;

            case 'units_of_production':
                // This would require additional data about units produced
                // For now, fall back to straight line
                $depreciableAmount = $asset->original_cost - $asset->salvage_value;
                return $asset->useful_life_months > 0 ? $depreciableAmount / $asset->useful_life_months : 0;

            default:
                return 0;
        }
    }

    /**
     * Create journal entry for depreciation.
     */
    private function createDepreciationJournalEntry(AssetDepreciation $depreciation, FixedAsset $asset): void
    {
        // Get depreciation expense account
        $depreciationExpenseAccount = ChartOfAccount::where('account_code', '6300')
            ->where('company_id', auth()->user()->company_id)
            ->first();

        // Get accumulated depreciation account
        $accumulatedDepreciationAccount = ChartOfAccount::where('account_code', '1520')
            ->where('company_id', auth()->user()->company_id)
            ->first();

        if (!$depreciationExpenseAccount || !$accumulatedDepreciationAccount) {
            throw new \Exception('Depreciation accounts not found in chart of accounts');
        }

        $journalEntry = JournalEntry::create([
            'reference' => 'DEP-' . $asset->asset_tag . '-' . now()->format('Ym'),
            'description' => 'Depreciation - ' . $asset->name,
            'transaction_date' => $depreciation->depreciation_date,
            'total_amount' => $depreciation->depreciation_amount,
            'status' => 'posted',
            'type' => 'depreciation',
            'source_id' => $depreciation->id,
            'source_type' => 'App\Models\AssetDepreciation',
            'company_id' => auth()->user()->company_id,
            'created_by' => auth()->id(),
        ]);

        // Debit depreciation expense
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $depreciationExpenseAccount->id,
            'type' => 'debit',
            'amount' => $depreciation->depreciation_amount,
            'description' => 'Depreciation expense - ' . $asset->name,
            'company_id' => auth()->user()->company_id,
        ]);

        // Credit accumulated depreciation
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $accumulatedDepreciationAccount->id,
            'type' => 'credit',
            'amount' => $depreciation->depreciation_amount,
            'description' => 'Accumulated depreciation - ' . $asset->name,
            'company_id' => auth()->user()->company_id,
        ]);
    }

    /**
     * Update depreciation journal entry when amount changes.
     */
    private function updateDepreciationJournalEntry(AssetDepreciation $depreciation): void
    {
        // Find the journal entry
        $journalEntry = JournalEntry::where('source_id', $depreciation->id)
            ->where('source_type', 'App\Models\AssetDepreciation')
            ->where('type', 'depreciation')
            ->first();

        if ($journalEntry) {
            // Delete old journal entry items
            $journalEntry->journalEntryItems()->delete();

            // Update total amount
            $journalEntry->update(['total_amount' => $depreciation->depreciation_amount]);

            // Recreate journal entry items
            $this->createDepreciationJournalEntry($depreciation, $depreciation->fixedAsset);
        }
    }
}
