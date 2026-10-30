<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The search box at the top of every page: invoices (by NSK/0427 or INV number), orders (by
 * order number or their invoice's number) and customers (by name), a few of each, each only
 * if the user may see that kind of record.
 */
class GlobalSearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));
        if (mb_strlen($term) < 2) {
            return response()->json(['invoices' => [], 'orders' => [], 'customers' => []]);
        }
        $user = $request->user();
        $role = $user->role;
        $can = fn (string $permission) => $role && ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company') || $role->hasPermission($permission));
        $customerName = fn ($c) => $c ? (trim((string) ($c->business_name ?: $c->name)) ?: null) : null;

        $invoices = $can('can_view_invoices')
            ? Invoice::where('company_id', $user->company_id)
                ->whereNumberMatches($term)
                ->with('customer:id,name,business_name')
                ->orderByDesc('created_at')
                ->limit(6)
                ->get(['id', 'invoice_number', 'file_number', 'customer_id', 'total_amount', 'status'])
                ->map(fn ($i) => ['id' => $i->id, 'number' => $i->invoice_number, 'customer' => $customerName($i->customer), 'amount' => (float) $i->total_amount, 'status' => $i->status])
            : collect();

        $orders = $can('can_view_orders')
            ? Order::where('company_id', $user->company_id)
                ->where(fn ($q) => $q->where('order_number', 'ilike', "%{$term}%")
                    ->orWhereHas('invoice', fn ($iq) => $iq->whereNumberMatches($term)))
                ->with(['customer:id,name,business_name', 'invoice:id,order_id,invoice_number,file_number'])
                ->orderByDesc('order_date')
                ->limit(6)
                ->get(['id', 'order_number', 'customer_id', 'final_amount', 'status', 'order_date'])
                ->map(fn ($o) => ['id' => $o->id, 'number' => preg_replace('/^([A-Z]+)-[\w-]+-(\d{4})$/', '$1-$2', (string) $o->order_number), 'invoice_number' => $o->invoice?->invoice_number, 'customer' => $customerName($o->customer), 'amount' => (float) $o->final_amount, 'status' => $o->status])
            : collect();

        $customers = $can('can_view_customers')
            ? Customer::where('company_id', $user->company_id)
                ->where(fn ($q) => $q->where('name', 'ilike', "%{$term}%")->orWhere('business_name', 'ilike', "%{$term}%"))
                ->orderBy('name')
                ->limit(6)
                ->get(['id', 'name', 'business_name', 'city'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $customerName($c), 'city' => $c->city])
            : collect();

        return response()->json(['invoices' => $invoices, 'orders' => $orders, 'customers' => $customers]);
    }
}
