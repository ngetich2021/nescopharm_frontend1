<?php

namespace App\Http\Controllers;

use App\Models\DeliveryInvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DeliveryInvoiceController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) return false;
        if ($role->hasPermission('can_manage_system')) return true;
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) return $user->company_id === $resourceCompanyId;
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * List delivery invoices - shown to accountants as "Delivery Invoices" in Sales/Invoices.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_delivery_invoices', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view delivery invoices.'], 403);
        }

        $query = DeliveryInvoice::with(['orderDispatch.order.customer', 'deliveryRate', 'createdBy', 'paidBy', 'logistic.deliveryPerson:id,full_name,phone_number'])
            ->where('company_id', $user->company_id);

        // Status filter
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Search by invoice number, transporter, zone, or order number
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhere('transporter_invoice_number', 'like', "%{$search}%")
                  ->orWhere('transporter_name', 'like', "%{$search}%")
                  ->orWhere('zone', 'like', "%{$search}%")
                  ->orWhere('order_reference', 'ilike', "%{$search}%")
                  ->orWhereHas('orderDispatch.order', function ($subQ) use ($search) {
                      $subQ->where('order_number', 'like', "%{$search}%");
                  })
                  ->orWhereHas('orderDispatch.order.customer', function ($subQ) use ($search) {
                      $subQ->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $sortOrder = in_array(strtolower($sortOrder), ['asc', 'desc']) ? strtolower($sortOrder) : 'desc';

        switch($sortBy) {
            case 'invoice_number':
            case 'transporter_name':
            case 'zone':
            case 'number_of_cartons':
            case 'total_amount':
            case 'status':
                $query->orderBy($sortBy, $sortOrder);
                break;
            case 'order_number':
                $query->orderBy(function ($q) {
                    $q->select('order_number')
                      ->from('orders')
                      ->whereColumn('orders.id', 'order_dispatches.order_id');
                }, $sortOrder);
                break;
            case 'customer_name':
                $query->orderBy(function ($q) {
                    $q->select('name')
                      ->from('customers')
                      ->whereColumn('customers.id', 'orders.customer_id')
                      ->whereColumn('orders.id', 'order_dispatches.order_id');
                }, $sortOrder);
                break;
            default:
                $query->orderBy('created_at', $sortOrder);
        }

        // Pagination
        $perPage = min((int) $request->input('per_page', 20), 100);
        $page = max(1, (int) $request->input('page', 1));
        $total = $query->count();
        $invoices = $query->skip(($page - 1) * $perPage)->take($perPage)->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery invoices retrieved successfully.',
            'data' => $invoices,
            'pagination' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => ceil($total / $perPage),
                'from' => ($page - 1) * $perPage + 1,
                'to' => min($page * $perPage, $total),
            ],
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_delivery_invoices', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view delivery invoices.'], 403);
        }

        $invoice = DeliveryInvoice::with([
                'orderDispatch.order.customer',
                'orderDispatch.items.product',
                'logistic.deliveryPerson:id,full_name,phone_number',
                'deliveryRate',
                'createdBy',
                'paidBy',
                'company' => function ($query) {
                    $query->select('id', 'name', 'logo_url', 'letterhead_url', 'address', 'phone', 'email');
                },
            ])
            ->where('company_id', $user->company_id)
            ->find($id);

        if (!$invoice) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery invoice not found.'], 404);
        }

        return response()->json(['status' => 'success', 'delivery_invoice' => $invoice], 200);
    }

    /**
     * Accountant marks a delivery invoice as paid. This unblocks the dispatch
     * from proceeding (see OrderDispatchController::dispatch()).
     */
    public function pay(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_pay_delivery_invoices', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to pay delivery invoices.'], 403);
        }

        $invoice = DeliveryInvoice::where('company_id', $user->company_id)->find($id);

        if (!$invoice) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery invoice not found.'], 404);
        }

        if ($invoice->status === 'paid') {
            return response()->json(['status' => 'failed', 'message' => 'This delivery invoice has already been paid.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'payment_method' => 'required|string|in:cash,mpesa,bank_transfer,cheque,other',
            'payment_reference' => 'nullable|string|max:255',
            'payment_date' => 'nullable|date',
            'cheque_number' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:255',
            'cheque_maturity_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        // Cheque payment safeguard validation
        if ($request->input('payment_method') === 'cheque') {
            if (!$request->filled('cheque_number') || !$request->filled('bank_name') || !$request->filled('cheque_maturity_date')) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cheque number, bank name, and maturity date are required for cheque payments.',
                ], 422);
            }
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($invoice, $user, $request) {
            // Also records the payment to the transporter (Payments page, statement, books).
            $invoice->recordPayment(
                $user->id,
                $request->input('payment_method'),
                $request->input('payment_reference'),
                $request->input('payment_date'),
                $request->only(['cheque_number', 'bank_name', 'cheque_maturity_date']),
            );

            // Payment only settles the transporter - the dispatch already moved on when
            // logistics were recorded, so its delivery status is left as it is.
            $logistic = \App\Models\Logistic::where('delivery_invoice_id', $invoice->id)->first();
            if ($logistic) {
                $logistic->update([
                    'payment_status' => 'paid',
                    'amount_paid' => $invoice->total_amount,
                    'payment_method' => $request->input('payment_method'),
                    'payment_reference' => $request->input('payment_reference'),
                    'payment_date' => $request->input('payment_date') ?? now(),
                    'cheque_number' => $request->input('cheque_number'),
                    'bank_name' => $request->input('bank_name'),
                    'cheque_maturity_date' => $request->input('cheque_maturity_date'),
                ]);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery invoice marked as paid.',
            'delivery_invoice' => $invoice->fresh(['orderDispatch.order', 'deliveryRate', 'createdBy', 'paidBy']),
        ], 200);
    }

    /**
     * Transporters (from delivery rates and delivery invoices) with what they have billed, been paid and
     * are owed, for picking whose statement to see. Their statement is GET /suppliers/{supplier_id}/statement.
     */
    public function transporters(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_delivery_invoices', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view delivery invoices.'], 403);
        }

        $names = DeliveryInvoice::where('company_id', $user->company_id)->pluck('transporter_name')
            ->concat(\App\Models\DeliveryRate::where('company_id', $user->company_id)->pluck('transporter_name'))
            ->filter()->map(fn ($n) => trim($n))->unique(fn ($n) => mb_strtolower($n));

        // Read only: a transporter that has never been invoiced has no supplier record yet and is skipped.
        $rows = $names->map(function ($name) use ($user) {
            $supplier = \App\Models\Supplier::where('company_id', $user->company_id)
                ->whereRaw('lower(trim(name)) = ?', [mb_strtolower($name)])->first();
            if (!$supplier) {
                return null;
            }
            $billed = (float) DeliveryInvoice::where('supplier_id', $supplier->id)->where('status', '!=', 'cancelled')->sum('total_amount');
            $paid = (float) \App\Models\SupplierPayment::where('supplier_id', $supplier->id)->where('status', 'completed')->sum('amount');
            return [
                'supplier_id' => $supplier->id,
                'name' => $supplier->name,
                'invoices' => DeliveryInvoice::where('supplier_id', $supplier->id)->where('status', '!=', 'cancelled')->count(),
                'billed' => round($billed, 2),
                'paid' => round($paid, 2),
                'balance' => round($billed - $paid, 2),
            ];
        })->filter()->sortBy('name')->values();

        return response()->json(['status' => 'success', 'data' => $rows]);
    }

    public function exportExcel(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_delivery_invoices', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to export delivery invoices.'], 403);
        }

        $query = DeliveryInvoice::with(['orderDispatch.order.customer', 'deliveryRate'])
            ->where('company_id', $user->company_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhere('transporter_name', 'like', "%{$search}%")
                  ->orWhere('zone', 'like', "%{$search}%");
            });
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->input('supplier_id'));
        }

        $invoices = $query->orderBy('invoice_date')->orderBy('invoice_number')->get();

        // Same columns as the Delivery Invoices import template (plus S/No.), so the file can be edited
        // and uploaded back: a row keeps its Invoice No. and updates that invoice.
        $methods = ['bank_transfer' => 'Bank Transfer', 'cash' => 'Cash', 'mpesa' => 'M-Pesa', 'cheque' => 'Cheque'];
        $headers = ['S/No.', 'Invoice No.', 'Invoice Date', 'Transporter', 'Transporter Invoice No.', 'Order No.', 'Customer / Destination',
            'Zone', 'Cartons', 'Rate per Carton', 'Amount', 'Status', 'Payment Date', 'Payment Method', 'Payment Reference', 'Notes'];
        $rows = $invoices->values()->map(fn ($invoice, $i) => [
            $i + 1,
            $invoice->invoice_number,
            optional($invoice->invoice_date ?? $invoice->created_at)->format('d/m/Y'),
            $invoice->transporter_name,
            $invoice->transporter_invoice_number,
            $invoice->orderDispatch?->order?->order_number,
            $invoice->orderDispatch?->order?->customer?->name ?? $invoice->order_reference,
            $invoice->zone ? ucfirst($invoice->zone) : null,
            $invoice->number_of_cartons,
            $invoice->rate_per_carton !== null ? (float) $invoice->rate_per_carton : null,
            (float) $invoice->total_amount,
            ['paid' => 'Paid', 'cancelled' => 'Cancelled'][$invoice->status] ?? 'Unpaid',
            $invoice->status === 'paid' ? optional($invoice->payment_date)->format('d/m/Y') : null,
            $invoice->status === 'paid' ? ($methods[$invoice->payment_method] ?? $invoice->payment_method) : null,
            $invoice->status === 'paid' ? $invoice->payment_reference : null,
            $invoice->notes,
        ]);

        $book = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $book->getActiveSheet()->setTitle('Delivery Invoices');
        $sheet->fromArray([$headers, ...$rows->all()], null, 'A1', true);
        $sheet->getStyle('A1:P1')->getFont()->setBold(true);
        foreach (range('A', 'P') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        $sheet->getStyle('J2:K' . ($rows->count() + 1))->getNumberFormat()->setFormatCode('#,##0.00');

        $filename = 'delivery-invoices-' . now()->format('Y-m-d') . '.xlsx';
        return response()->streamDownload(function () use ($book) {
            (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save('php://output');
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    public function cancel(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_pay_delivery_invoices', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to cancel delivery invoices.'], 403);
        }

        $invoice = DeliveryInvoice::where('company_id', $user->company_id)->find($id);

        if (!$invoice) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery invoice not found.'], 404);
        }

        $invoice->cancel();

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery invoice cancelled.',
            'delivery_invoice' => $invoice->fresh(),
        ], 200);
    }
}
