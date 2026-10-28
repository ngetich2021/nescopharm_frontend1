<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SupplierController extends Controller
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

    // Suppliers are browsed as a picker from several unrelated workflows
    // (product create/edit, purchase orders, product receipts, supplier
    // payments) - gating the list behind can_view_suppliers alone breaks
    // any role that can do those things but isn't a supplier manager.
    protected const SUPPLIER_BROWSING_WORKFLOW_PERMISSIONS = [
        'can_view_suppliers',
        'can_create_products',
        'can_update_products',
        'can_create_purchase_orders',
        'can_update_purchase_orders',
        'can_receive_purchase_orders',
        'can_create_product_receipts',
        'can_update_product_receipts',
        'can_create_payments',
        'can_update_payments',
        'can_manage_payments',
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $canBrowseSuppliers = collect(self::SUPPLIER_BROWSING_WORKFLOW_PERMISSIONS)
            ->contains(fn ($permission) => $this->hasPermission($request, $permission, $user->company_id));

        if (!$canBrowseSuppliers) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view suppliers.',
                'data' => null
            ], 403);
        }

        $query = Supplier::forCompany($user->company_id)->active();

        // Allow explicit override if is_active passed
        if ($request->has('is_active')) {
            $raw = $request->input('is_active');
            $bool = filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($bool !== null) {
                $query = Supplier::forCompany($user->company_id)->where('is_active', $bool);
            }
        }

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', "%{$term}%")
                    ->orWhere('email', 'ilike', "%{$term}%")
                    ->orWhere('phone', 'ilike', "%{$term}%")
                    ->orWhere('address', 'ilike', "%{$term}%");
            });
        }

        $suppliers = $query->orderByDesc('created_at')->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Suppliers retrieved successfully.',
            'data' => $suppliers
        ]);
    }

    public function show($id)
    {
        $request = request();
        $user = $request->user();
        $canBrowseSuppliers = collect(self::SUPPLIER_BROWSING_WORKFLOW_PERMISSIONS)
            ->contains(fn ($permission) => $this->hasPermission($request, $permission));
        if (!$canBrowseSuppliers) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view suppliers.', 'data' => null], 403);
        }
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return response()->json(['status' => 'failed', 'message' => 'Supplier not found.', 'data' => null], 404);
        }
        $canBrowseThisSupplier = collect(self::SUPPLIER_BROWSING_WORKFLOW_PERMISSIONS)
            ->contains(fn ($permission) => $this->hasPermission($request, $permission, $supplier->company_id));
        if (!$canBrowseThisSupplier) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view supplier.', 'data' => null], 403);
        }
        if (!$supplier) {
            return response()->json(['status' => 'failed', 'message' => 'Supplier not found.', 'data' => null], 404);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Supplier retrieved successfully.',
            'data' => $supplier
        ]);
    }

    /**
     * The supplier's account, oldest first: bills (and opening balances) raise what is owed, debit
     * notes and payments bring it down. A goods receipt shows as a bill unless one already covers it.
     */
    public function statement(Request $request, $id)
    {
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return response()->json(['status' => 'failed', 'message' => 'Supplier not found.', 'data' => null], 404);
        }
        $canBrowse = collect(self::SUPPLIER_BROWSING_WORKFLOW_PERMISSIONS)
            ->contains(fn ($permission) => $this->hasPermission($request, $permission, $supplier->company_id));
        if (!$canBrowse) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view supplier.', 'data' => null], 403);
        }

        $entries = collect();
        $bills = DB::table('accounts_payable')->where('vendor_id', $supplier->id)
            ->whereNotIn('status', ['draft', 'cancelled'])->get();
        foreach ($bills as $b) {
            $meta = json_decode($b->metadata ?? '{}', true) ?: [];
            $kind = $meta['kind'] ?? 'bill';
            $amount = round((float) $b->total_amount, 2);
            $entries->push([
                'date' => substr((string) $b->invoice_date, 0, 10),
                'type' => $kind,
                'reference' => $b->invoice_number,
                'description' => $b->description ?: ($kind === 'debit_note' ? 'Debit note' : 'Bill'),
                'billed' => $kind === 'debit_note' ? 0.0 : $amount,
                'paid' => $kind === 'debit_note' ? $amount : 0.0,
            ]);
        }
        $covered = $bills->map(fn ($b) => json_decode($b->metadata ?? '{}', true)['receipt_id'] ?? null)->filter()->all();

        $receipts = DB::table('product_receipts as r')
            ->leftJoin('purchase_orders as po', 'po.id', '=', 'r.purchase_order_id')
            ->where('r.supplier_id', $supplier->id)
            ->whereNotIn('r.id', $covered)
            ->select('r.product_receipt_number', 'r.reference_number', 'r.created_at', 'r.shipping_cost', 'r.logistics_cost', 'po.tax_rate',
                DB::raw('(SELECT COALESCE(SUM(COALESCE(i.quantity, 0) * COALESCE(i.unit_price, 0)), 0) FROM product_receipt_items i WHERE i.product_receipt_id = r.id) as goods'))
            ->get();
        foreach ($receipts as $r) {
            $goods = round((float) $r->goods, 2);
            $vat = (float) $r->tax_rate > 0 ? round($goods * (float) $r->tax_rate / 100, 2) : 0.0;
            $entries->push([
                'date' => substr((string) $r->created_at, 0, 10),
                'type' => 'receipt',
                'reference' => $r->product_receipt_number,
                'description' => 'Goods received' . ($r->reference_number ? " (invoice {$r->reference_number})" : ''),
                'billed' => round($goods + (float) $r->shipping_cost + (float) $r->logistics_cost + $vat, 2),
                'paid' => 0.0,
            ]);
        }

        $payments = DB::table('supplier_payments')->where('supplier_id', $supplier->id)->where('status', 'completed')->get();
        foreach ($payments as $p) {
            $entries->push([
                'date' => substr((string) $p->payment_date, 0, 10),
                'type' => 'payment',
                'reference' => $p->payment_number,
                'description' => 'Payment - ' . ucwords(str_replace('_', ' ', (string) $p->payment_method))
                    . ($p->transaction_reference ? " ({$p->transaction_reference})" : ''),
                'billed' => 0.0,
                'paid' => round((float) $p->amount, 2),
            ]);
        }

        // Bills before payments on the same day, as on the supplier's ledger.
        $order = ['opening_balance' => 0, 'bill' => 1, 'receipt' => 1, 'debit_note' => 2, 'payment' => 3];
        $balance = 0.0;
        $rows = $entries->sortBy([['date', 'asc'], fn ($a, $b) => ($order[$a['type']] ?? 9) <=> ($order[$b['type']] ?? 9)])
            ->values()
            ->map(function ($e) use (&$balance) {
                $balance = round($balance + $e['billed'] - $e['paid'], 2);
                return $e + ['balance' => $balance];
            });

        return response()->json([
            'status' => 'success',
            'data' => [
                'entries' => $rows,
                'totals' => [
                    'billed' => round($rows->sum('billed'), 2),
                    'paid' => round($rows->sum('paid'), 2),
                    'balance' => $balance,
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        // can_create_suppliers is what roles (e.g. Accountant) are given and what the Add Supplier button checks.
        if (!$this->hasPermission($request, 'can_create_suppliers', $user->company_id)
            && !$this->hasPermission($request, 'can_manage_suppliers', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create suppliers.', 'data' => null], 403);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:32',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'bank_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:64',
            'bank_branch' => 'nullable|string|max:255',
            'bank_swift_code' => 'nullable|string|max:64',
            'payment_terms_type' => 'nullable|string|max:64',
            'payment_terms_days' => 'nullable|integer|min:0',
            'payment_terms_description' => 'nullable|string',
            'tax_information' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'data' => null], 400);
        }

        try {
            return DB::transaction(function () use ($request, $user) {
                // Debug: log the values before creation
                $data = [
                    'id' => (string) Str::uuid(),
                    'company_id' => $user->company_id,
                    'name' => $request->input('name'),
                    'email' => $request->input('email'),
                    'phone' => $request->input('phone'),
                    'address' => $request->input('address'),
                    'contact_person' => $request->input('contact_person'),
                    'notes' => $request->input('notes'),
                    'is_active' => $request->input('is_active', true),
                    'bank_name' => $request->input('bank_name'),
                    'bank_account_number' => $request->input('bank_account_number'),
                    'bank_branch' => $request->input('bank_branch'),
                    'bank_swift_code' => $request->input('bank_swift_code'),
                    'payment_terms_type' => $request->input('payment_terms_type'),
                    'payment_terms_days' => $request->input('payment_terms_days'),
                    'payment_terms_description' => $request->input('payment_terms_description'),
                    'tax_information' => $request->input('tax_information'),
                ];

                Log::info('Creating supplier with data:', $data);
                Log::info('is_active value type: ' . gettype($data['is_active']));

                $supplier = Supplier::create($data);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Supplier created successfully.',
                    'data' => $supplier
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create supplier', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create supplier: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_suppliers', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update suppliers.', 'data' => null], 403);
        }
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return response()->json(['status' => 'failed', 'message' => 'Supplier not found.', 'data' => null], 404);
        }
        if (!$this->hasPermission($request, 'can_update_suppliers', $supplier->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update supplier.', 'data' => null], 403);
        }
        if (!$supplier) {
            return response()->json(['status' => 'failed', 'message' => 'Supplier not found.', 'data' => null], 404);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:32',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'bank_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:64',
            'bank_branch' => 'nullable|string|max:255',
            'bank_swift_code' => 'nullable|string|max:64',
            'payment_terms_type' => 'nullable|string|max:64',
            'payment_terms_days' => 'nullable|integer|min:0',
            'payment_terms_description' => 'nullable|string',
            'tax_information' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors(), 'data' => null], 400);
        }

        $data = $validator->validated();

        // Ensure is_active is properly cast as boolean if provided
        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        $supplier->update($data);
        return response()->json([
            'status' => 'success',
            'message' => 'Supplier updated successfully.',
            'data' => $supplier
        ]);
    }

    public function destroy($id)
    {
        $user = request()->user();
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return response()->json(['status' => 'failed', 'message' => 'Supplier not found.', 'data' => null], 404);
        }
        if (!$this->hasPermission(request(), 'can_manage_suppliers', $supplier->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete suppliers.', 'data' => null], 403);
        }
        $supplier->delete();
        return response()->json(['status' => 'success', 'message' => 'Supplier deleted.', 'data' => null]);
    }

}
