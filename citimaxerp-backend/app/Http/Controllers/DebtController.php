<?php

namespace App\Http\Controllers;

use App\Models\Debt;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DebtController extends Controller
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
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view debts.',
            ], 403);
        }
        $query = Debt::with(['customer', 'order', 'company', 'payment']);
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $user->company_id);
        } else if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->input('customer_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $debts = $query->orderBy('created_at', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'debts' => $debts,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $request->input('company_id', $user->company_id))) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create debts.',
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|uuid|exists:customers,id',
            'order_id' => 'nullable|uuid|exists:orders,id',
            'company_id' => 'required|uuid|exists:companies,id',
            'amount' => 'required|numeric|min:0.01',
            'status' => 'nullable|string',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'payment_id' => 'nullable|uuid|exists:payments,id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }
        $debt = Debt::create(array_merge(
            $validator->validated(),
            ['id' => (string) Str::uuid()]
        ));
        return response()->json([
            'status' => 'success',
            'debt' => $debt,
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $debt = Debt::with(['customer', 'order', 'company', 'payment'])->find($id);
        if (!$debt) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Debt not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $debt->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this debt.',
            ], 403);
        }
        return response()->json([
            'status' => 'success',
            'debt' => $debt,
        ]);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $debt = Debt::find($id);
        if (!$debt) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Debt not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $debt->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this debt.',
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'amount' => 'sometimes|numeric|min:0.01',
            'status' => 'sometimes|string|in:unpaid,paid,partial,overdue',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'payment_id' => 'nullable|uuid|exists:payments,id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }
        $oldStatus = $debt->status;
        $debt->update($validator->validated());
        // Auto-update debt status to paid if balance is 0
        if ($debt->amount == 0 && $debt->status !== 'paid') {
            $debt->status = 'paid';
            $debt->save();
        }
        // Sync order amount_paid if debt is marked as paid
        if ($oldStatus !== 'paid' && $debt->status === 'paid' && $debt->order_id) {
            $order = $debt->order;

            if ($order) {
                $newAmountPaid = $order->amount_paid + $debt->amount;
                // Check if all debts for this order are paid or balance is 0
                $remainingDebt = Debt::where('order_id', $order->id)
                    ->where('status', '!=', 'paid')
                    ->sum('amount');
                $paymentStatus = 'partial';
                if ($remainingDebt <= 0) {
                    $paymentStatus = 'paid';
                }
                $order->update([
                    'amount_paid' => $newAmountPaid,
                    'payment_status' => $paymentStatus,
                ]);
            }
        }
        return response()->json([
            'status' => 'success',
            'debt' => $debt,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $debt = Debt::find($id);
        if (!$debt) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Debt not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $debt->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this debt.',
            ], 403);
        }
        $debt->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'Debt deleted successfully.',
        ]);
    }

    // List customers with debt
    public function customersWithDebt(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view customers with debt.',
            ], 403);
        }
        $query = Debt::where('status', '!=', 'paid');
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $user->company_id);
        } else if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }
        $customerIds = $query->pluck('customer_id')->filter()->unique();
        $customers = Customer::whereIn('id', $customerIds)->get();
        return response()->json([
            'status' => 'success',
            'customers' => $customers,
        ]);
    }

    // Update a debt by order_id
    public function updateByOrderId(Request $request, $order_id)
    {
        $user = $request->user();
        $debt = Debt::where('order_id', $order_id)->first();
        if (!$debt) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Debt not found for this order.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $debt->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this debt.',
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'amount' => 'sometimes|numeric|min:0.01',
            'status' => 'sometimes|string|in:unpaid,paid,partial,overdue',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'payment_id' => 'nullable|uuid|exists:payments,id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }
        $oldStatus = $debt->status;
        $debt->update($validator->validated());
        // Auto-update debt status to paid if balance is 0
        if ($debt->amount == 0 && $debt->status !== 'paid') {
            $debt->status = 'paid';
            $debt->save();
        }
        // Sync order amount_paid if debt is marked as paid
        if ($oldStatus !== 'paid' && $debt->status === 'paid' && $debt->order_id) {
            $order = $debt->order;
            if ($order) {
                $newAmountPaid = $order->amount_paid + $debt->amount;
                // Check if all debts for this order are paid or balance is 0
                $remainingDebt = Debt::where('order_id', $order->id)
                    ->where('status', '!=', 'paid')
                    ->sum('amount');
                $paymentStatus = 'partial';
                if ($remainingDebt <= 0) {
                    $paymentStatus = 'paid';
                }
                $order->update([
                    'amount_paid' => $newAmountPaid,
                    'payment_status' => $paymentStatus,
                ]);
            }
        }
        return response()->json([
            'status' => 'success',
            'debt' => $debt,
        ]);
    }
}
