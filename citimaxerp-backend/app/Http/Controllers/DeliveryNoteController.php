<?php

namespace App\Http\Controllers;

use App\Models\DeliveryNote;
use App\Models\OrderDispatch;
use Illuminate\Http\Request;

class DeliveryNoteController extends Controller
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

    public function index(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_order_dispatches', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view delivery notes.'], 403);
        }

        $query = DeliveryNote::with(['orderDispatch.order.customer', 'generatedBy'])
            ->where('company_id', $user->company_id);

        if ($request->filled('order_dispatch_id')) {
            $query->where('order_dispatch_id', $request->input('order_dispatch_id'));
        }

        $notes = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery notes retrieved successfully.',
            'delivery_notes' => $notes,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();

        $note = DeliveryNote::with(['orderDispatch.order.customer', 'generatedBy'])
            ->where('company_id', $user->company_id)
            ->find($id);

        if (!$note) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery note not found.'], 404);
        }

        return response()->json(['status' => 'success', 'delivery_note' => $note], 200);
    }

    /**
     * Auto-generate a delivery note from a completed dispatch's items.
     * Called internally once a dispatch is marked delivered - see
     * OrderDispatchController::dispatch()/markDelivered().
     */
    public static function generateForDispatch(OrderDispatch $dispatch, ?string $generatedBy = null): DeliveryNote
    {
        $existing = DeliveryNote::where('order_dispatch_id', $dispatch->id)->first();
        if ($existing) {
            return $existing;
        }

        $items = $dispatch->items()->with(['product', 'variant'])->get()->map(function ($item) {
            return [
                'product_id' => $item->product_id,
                'variant_id' => $item->variant_id,
                'product_name' => $item->product
                    ? \App\Models\ProductVariant::sizedName($item->product->name, $item->variant?->name)
                    : 'Unknown Product',
                'sku' => $item->product->sku ?? null,
                'quantity_dispatched' => $item->quantity,
                'delivered_quantity' => $item->delivered_quantity,
                'damaged_quantity' => $item->damaged_quantity ?? 0,
            ];
        })->toArray();

        return DeliveryNote::create([
            'company_id' => $dispatch->company_id,
            'order_dispatch_id' => $dispatch->id,
            'note_number' => DeliveryNote::generateNumber($dispatch->company_id),
            'status' => 'finalized',
            'items' => $items,
            'special_instructions' => $dispatch->special_instructions,
            'generated_by' => $generatedBy,
            'finalized_at' => now(),
        ]);
    }
}
