<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Models\Etims\EtimsSupplierReceipt;
use App\Models\AccountsPayable;
use App\Services\TaxCompliance\EtimsSupplierReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * AP-side supplier receipt upload + verify.
 *
 *   POST   /api/etims/supplier-receipts                    - upload + auto-verify
 *   GET    /api/etims/supplier-receipts                    - list (filterable by status)
 *   POST   /api/etims/supplier-receipts/{id}/verify        - manual re-verify
 *   POST   /api/etims/supplier-receipts/{id}/link-bill     - link to an AccountsPayable bill
 *   GET    /api/etims/supplier-receipts/reconciliation     - signed vs unsigned summary
 */
class EtimsSupplierReceiptController extends Controller
{
    public function __construct(
        private readonly EtimsSupplierReceiptService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $query = EtimsSupplierReceipt::query()->where('company_id', $companyId);

        if ($request->boolean('only_unsigned')) {
            $query->whereIn('verification_status', [EtimsSupplierReceipt::PENDING, EtimsSupplierReceipt::INVALID]);
        } elseif ($status = $request->query('status')) {
            $query->where('verification_status', $status);
        }

        return response()->json(['data' => $query->orderByDesc('created_at')->paginate(50)]);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $data = $request->validate([
            'qr_payload' => ['required', 'string'],
            'supplier_kra_pin' => ['nullable', 'string', 'regex:/^P\d{9}[A-Z]$/'],
            'trader_invoice_number' => ['nullable', 'string'],
            'supplier_id' => ['nullable', 'uuid'],
            'supplier_bill_id' => ['nullable', 'uuid'],
            'upload' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:10240'],
        ]);

        $uploadPath = null;
        $uploadMime = null;
        if ($request->hasFile('upload')) {
            $file = $request->file('upload');
            $uploadPath = $file->store("etims-receipts/{$companyId}");
            $uploadMime = $file->getMimeType();
        }

        $receipt = EtimsSupplierReceipt::create([
            'company_id' => $companyId,
            'uploaded_by' => Auth::id(),
            'supplier_id' => $data['supplier_id'] ?? null,
            'supplier_bill_id' => $data['supplier_bill_id'] ?? null,
            'qr_payload' => $data['qr_payload'],
            'supplier_kra_pin' => $data['supplier_kra_pin'] ?? null,
            'trader_invoice_number' => $data['trader_invoice_number'] ?? null,
            'upload_path' => $uploadPath,
            'upload_mime' => $uploadMime,
            'verification_status' => EtimsSupplierReceipt::PENDING,
        ]);

        // Verify immediately - DigiTax /verify is synchronous
        $receipt = $this->service->verify($receipt);

        return response()->json(['receipt' => $receipt], 201);
    }

    public function verify(Request $request, string $id): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $receipt = EtimsSupplierReceipt::where('company_id', $companyId)->findOrFail($id);

        return response()->json(['receipt' => $this->service->verify($receipt)]);
    }

    public function linkBill(Request $request, string $id): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $receipt = EtimsSupplierReceipt::where('company_id', $companyId)->findOrFail($id);

        $data = $request->validate([
            'supplier_bill_id' => ['required', 'uuid', 'exists:accounts_payable,id'],
        ]);
        AccountsPayable::where('company_id', $companyId)->findOrFail($data['supplier_bill_id']);
        $receipt->update(['supplier_bill_id' => $data['supplier_bill_id']]);

        return response()->json(['receipt' => $receipt->fresh()]);
    }

    public function reconciliation(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();

        $verified = EtimsSupplierReceipt::where('company_id', $companyId)
            ->where('verification_status', EtimsSupplierReceipt::VERIFIED)
            ->count();
        $pending = EtimsSupplierReceipt::where('company_id', $companyId)
            ->where('verification_status', EtimsSupplierReceipt::PENDING)
            ->count();
        $invalid = EtimsSupplierReceipt::where('company_id', $companyId)
            ->where('verification_status', EtimsSupplierReceipt::INVALID)
            ->count();
        $reclaimableSum = (float) EtimsSupplierReceipt::where('company_id', $companyId)
            ->where('vat_reclaimable', true)
            ->sum('tax_amount');

        return response()->json([
            'verified_count' => $verified,
            'pending_count' => $pending,
            'invalid_count' => $invalid,
            'vat_reclaimable_total' => $reclaimableSum,
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
