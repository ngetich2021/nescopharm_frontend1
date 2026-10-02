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
            $invoice->update([
                'status' => 'paid',
                'payment_method' => $request->input('payment_method'),
                'payment_reference' => $request->input('payment_reference'),
                'payment_date' => $request->input('payment_date') ?? now(),
                'cheque_number' => $request->input('cheque_number'),
                'bank_name' => $request->input('bank_name'),
                'cheque_maturity_date' => $request->input('cheque_maturity_date'),
                'amount_paid' => $invoice->total_amount,
                'paid_by' => $user->id,
            ]);

            // Unblock the logistics record and let the dispatch proceed.
            $logistic = \App\Models\Logistic::where('delivery_invoice_id', $invoice->id)->first();
            if ($logistic) {
                $logistic->update([
                    'delivery_status' => 'dispatched',
                    'payment_status' => 'paid',
                    'amount_paid' => $invoice->total_amount,
                    'payment_method' => $request->input('payment_method'),
                    'payment_reference' => $request->input('payment_reference'),
                    'payment_date' => $request->input('payment_date') ?? now(),
                    'cheque_number' => $request->input('cheque_number'),
                    'bank_name' => $request->input('bank_name'),
                    'cheque_maturity_date' => $request->input('cheque_maturity_date'),
                ]);

                $dispatch = $logistic->orderDispatch;
                if ($dispatch) {
                    $dispatch->status = 'in_transit';
                    $dispatch->dispatch_date = now();
                    $dispatch->save();

                    if ($dispatch->order) {
                        $dispatch->order->update(['status' => 'dispatched']);
                    }

                    // Auto-generate delivery note once payment is received
                    DeliveryNoteController::generateForDispatch($dispatch, $user->id);
                }
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery invoice marked as paid. The dispatch can now proceed.',
            'delivery_invoice' => $invoice->fresh(['orderDispatch.order', 'deliveryRate', 'createdBy', 'paidBy']),
        ], 200);
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

        $invoices = $query->orderBy('created_at', 'desc')->get();

        // Generate CSV content
        $headers = ['Invoice #', 'Order', 'Customer', 'Transporter', 'Zone', 'Cartons', 'Rate/Carton', 'Total', 'Status', 'Date'];
        $rows = $invoices->map(function ($invoice) {
            return [
                $invoice->invoice_number,
                $invoice->orderDispatch?->order?->order_number ?? '-',
                $invoice->orderDispatch?->order?->customer?->name ?? '-',
                $invoice->transporter_name,
                $invoice->zone,
                $invoice->number_of_cartons,
                number_format((float)$invoice->rate_per_carton, 2),
                number_format((float)$invoice->total_amount, 2),
                ucfirst($invoice->status),
                $invoice->created_at->format('Y-m-d'),
            ];
        });

        // Create CSV
        $filename = 'delivery-invoices-' . now()->format('Y-m-d-His') . '.csv';
        $csv = collect([$headers])->merge($rows)->map(function ($row) {
            return implode(',', array_map(function ($value) {
                return '"' . str_replace('"', '""', (string)$value) . '"';
            }, $row));
        })->implode("\n");

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
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
