<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Jobs\Etims\SyncEtimsItemJob;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Product;
use App\Services\TaxCompliance\EtimsTaxType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Backend for the Product → KRA fields tab.
 *
 *   GET    /api/etims/items/{productId}        - current registration + reference data
 *   PATCH  /api/etims/items/{productId}        - update KRA fields on the registration
 *   POST   /api/etims/items/{productId}/sync   - kick a sync (or retry on failure)
 *   GET    /api/etims/items                    - list registrations, filterable by status
 *   GET    /api/etims/items/reference          - full reference data for the picker
 */
class EtimsItemController extends Controller
{
    public function show(Request $request, string $productId): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $product = Product::where('company_id', $companyId)->findOrFail($productId);
        $taxTypeCode = strtoupper((string) $request->query('tax_type_code'));
        if (! in_array($taxTypeCode, EtimsTaxType::VALID_CODES, true)) {
            $taxTypeCode = EtimsTaxType::forProduct($product);
        }

        $registration = EtimsItemRegistration::firstOrCreate(
            [
                'company_id' => $companyId,
                'product_id' => $product->id,
                'tax_type_code' => $taxTypeCode,
            ],
            ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
        );

        return response()->json([
            'product' => ['id' => $product->id, 'name' => $product->name, 'sku' => $product->sku],
            'registration' => $registration,
        ]);
    }

    public function update(Request $request, string $productId): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $product = Product::where('company_id', $companyId)->findOrFail($productId);

        $data = $request->validate([
            'item_class_code' => ['nullable', 'string', 'exists:etims_item_class_codes,code'],
            'item_type_code' => ['nullable', Rule::in(['1', '2', '3'])],
            'packaging_unit_code' => ['nullable', 'string', 'exists:etims_packaging_units,code'],
            'quantity_unit_code' => ['nullable', 'string', 'exists:etims_quantity_units,code'],
            'country_of_origin_code' => ['nullable', 'string', 'size:2'],
            'tax_type_code' => ['nullable', Rule::in(['A', 'B', 'C', 'D', 'E'])],
            'default_unit_price' => ['sometimes', 'numeric', 'gt:0'],
        ]);

        $taxTypeCode = $data['tax_type_code'] ?? EtimsTaxType::forProduct($product);
        $registration = EtimsItemRegistration::firstOrCreate(
            [
                'company_id' => $companyId,
                'product_id' => $product->id,
                'tax_type_code' => $taxTypeCode,
            ],
            ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
        );

        $registration->fill($data);
        if ($registration->isDirty('default_unit_price')
            && $registration->sync_status === EtimsItemRegistration::STATUS_FAILED
            && blank($registration->digitax_item_id)) {
            $registration->forceFill([
                'client_request_id' => null,
                'sync_status' => EtimsItemRegistration::STATUS_PENDING,
                'last_error' => null,
                'last_attempt_at' => null,
                'attempts' => 0,
            ]);
        }
        $registration->save();

        return response()->json(['registration' => $registration->fresh()]);
    }

    public function sync(Request $request, string $productId): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $product = Product::where('company_id', $companyId)->findOrFail($productId);

        SyncEtimsItemJob::dispatch($companyId, (string) $product->id);

        return response()->json(['queued' => true, 'message' => 'Sync queued. Status will update via webhook.']);
    }

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $status = $request->query('status'); // pending|synced|failed

        $query = EtimsItemRegistration::query()->where('company_id', $companyId);
        if (in_array($status, ['pending', 'synced', 'failed'], true)) {
            $query->where('sync_status', $status);
        }

        return response()->json([
            'data' => $query->orderByDesc('updated_at')->paginate(50),
        ]);
    }

    public function reference(): JsonResponse
    {
        return response()->json([
            'item_classes' => DB::table('etims_item_class_codes')->orderBy('code')->get(),
            'packaging_units' => DB::table('etims_packaging_units')->orderBy('name')->get(),
            'quantity_units' => DB::table('etims_quantity_units')->orderBy('name')->get(),
            'tax_types' => DB::table('etims_tax_types')->orderBy('code')->get(),
            'payment_types' => DB::table('etims_payment_types')->orderBy('code')->get(),
        ]);
    }

    private function resolveActiveCompanyId(): string
    {
        if (function_exists('active_company_id')) {
            $id = active_company_id();
            if ($id) {
                return (string) $id;
            }
        }
        $user = Auth::user();
        if ($user && $user->company_id) {
            return (string) $user->company_id;
        }
        abort(403, 'Cannot resolve active company.');
    }
}
