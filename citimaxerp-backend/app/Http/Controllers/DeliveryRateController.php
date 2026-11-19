<?php

namespace App\Http\Controllers;

use App\Models\DeliveryInvoice;
use App\Models\DeliveryRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DeliveryRateController extends Controller
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
     * List all delivery rates for the company.
     * Warehouse managers see all; accounting/dispatch flows only need approved+active ones.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_delivery_rates', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view delivery rates.'], 403);
        }

        $query = DeliveryRate::with([
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email'
            ])->where('company_id', $user->company_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('zone')) {
            $query->where('zone', $request->input('zone'));
        }
        if ($request->boolean('active_only')) {
            $query->where('status', 'approved')->whereRaw('is_active = true');
        }

        $rates = $query->orderBy('transporter_name')->orderBy('zone')->get();
        // The tab shows Approve from this, so it never disagrees with approve().
        $rates->each(fn (DeliveryRate $rate) => $rate->setAttribute('approval_block', $this->approvalBlock($rate, $user)));

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery rates retrieved successfully.',
            'delivery_rates' => $rates,
        ], 200);
    }

    /**
     * Why $user may not approve this rate, or null when they may: an accountant never approves one
     * they raised or last edited - another approver does.
     */
    protected function approvalBlock(DeliveryRate $rate, \App\Models\User $user): ?string
    {
        if (!\App\Models\Order::isAccountant($user)) {
            return null;
        }
        if ($rate->created_by === $user->id) {
            return 'You raised this delivery rate, so another approver (another accountant, the GM or a Director) must approve it.';
        }
        if ($rate->last_edited_by === $user->id) {
            return 'You last edited this delivery rate, so another approver (another accountant, the GM or a Director) must approve it.';
        }

        return null;
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $rate = DeliveryRate::with([
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email'
            ])->where('company_id', $user->company_id)
            ->find($id);

        if (!$rate) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery rate not found.'], 404);
        }

        return response()->json(['status' => 'success', 'delivery_rate' => $rate], 200);
    }

    /**
     * Create a new delivery rate (Warehouse Manager or Accountant). Starts as 'pending' until the GM, a Director or an Accountant approves.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_create_delivery_rates', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create delivery rates.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'transporter_name' => 'required|string|max:255',
            'zone' => 'required|in:nairobi,upcountry',
            'rate_per_carton' => 'required|numeric|min:0',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $transporter = $this->transporterName($user->company_id, $request->input('transporter_name'));
        if ($this->sameRateExists($user->company_id, $transporter, $request->input('zone'))) {
            return response()->json([
                'status' => 'failed',
                'message' => "A delivery rate for {$transporter} in this zone already exists.",
            ], 422);
        }

        $rate = DeliveryRate::create([
            'company_id' => $user->company_id,
            'transporter_name' => $transporter,
            'zone' => $request->input('zone'),
            'rate_per_carton' => (float) $request->input('rate_per_carton'),
            'description' => $request->input('description'),
            'status' => 'pending',
            'is_active' => (bool) false,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery rate submitted for approval.',
            'delivery_rate' => $rate->load('createdBy'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $rate = DeliveryRate::where('company_id', $user->company_id)->find($id);

        if (!$rate) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery rate not found.'], 404);
        }

        if (!$this->hasPermission($request, 'can_create_delivery_rates', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update delivery rates.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'transporter_name' => 'sometimes|string|max:255',
            'zone' => 'sometimes|in:nairobi,upcountry',
            'rate_per_carton' => 'sometimes|numeric|min:0',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $fields = $request->only(['transporter_name', 'zone', 'rate_per_carton', 'description']);
        if (isset($fields['transporter_name'])) {
            $fields['transporter_name'] = $this->transporterName($user->company_id, $fields['transporter_name']);
        }
        if ($this->sameRateExists($user->company_id, $fields['transporter_name'] ?? $rate->transporter_name, $fields['zone'] ?? $rate->zone, $rate->id)) {
            return response()->json(['status' => 'failed', 'message' => 'Another delivery rate for this transporter and zone already exists.'], 422);
        }

        // Editing an approved rate sends it back for re-approval.
        $rate->update($fields + ['last_edited_by' => $user->id]);
        if ($rate->status === 'approved') {
            $rate->update(['status' => 'pending', 'is_active' => false, 'approved_by' => null, 'approved_at' => null]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery rate updated successfully.',
            'delivery_rate' => $rate->fresh([
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email'
            ]),
        ], 200);
    }

    /**
     * Approve a delivery rate (GM, Director or Accountant; an accountant never one they raised or edited).
     */
    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $rate = DeliveryRate::where('company_id', $user->company_id)->find($id);

        if (!$rate) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery rate not found.'], 404);
        }

        if (!$this->hasPermission($request, 'can_approve_delivery_rates', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to approve delivery rates.'], 403);
        }
        if ($block = $this->approvalBlock($rate, $user)) {
            return response()->json(['status' => 'failed', 'message' => $block], 403);
        }

        $rate->approve($user->id, $request->input('notes'));

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery rate approved successfully.',
            'delivery_rate' => $rate->fresh([
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email'
            ]),
        ], 200);
    }

    /**
     * Reject a delivery rate (GM or Managing Director only).
     */
    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $rate = DeliveryRate::where('company_id', $user->company_id)->find($id);

        if (!$rate) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery rate not found.'], 404);
        }

        if (!$this->hasPermission($request, 'can_approve_delivery_rates', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to reject delivery rates.'], 403);
        }

        $rate->reject($user->id, $request->input('notes'));

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery rate rejected.',
            'delivery_rate' => $rate->fresh([
                'createdBy:id,first_name,last_name,email',
                'approvedBy:id,first_name,last_name,email'
            ]),
        ], 200);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $rate = DeliveryRate::where('company_id', $user->company_id)->find($id);

        if (!$rate) {
            return response()->json(['status' => 'failed', 'message' => 'Delivery rate not found.'], 404);
        }

        if (!$this->hasPermission($request, 'can_create_delivery_rates', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete delivery rates.'], 403);
        }

        // Only the rate goes: invoices and dispatches already raised on it keep their transporter, zone,
        // rate per carton and amounts. A wrong delivery invoice is deleted from the invoice itself.
        $rate->delete();

        return response()->json(['status' => 'success', 'message' => 'Delivery rate deleted.'], 200);
    }

    /** The name to store: an existing supplier's exact name when it is the same transporter ("Imevo Ltd" = "Imevo Limited"). */
    protected function transporterName(string $companyId, string $typed): string
    {
        return DeliveryInvoice::findTransporterSupplier($companyId, $typed)?->name ?? trim($typed);
    }

    protected function sameRateExists(string $companyId, string $transporter, string $zone, ?string $exceptId = null): bool
    {
        $key = DeliveryInvoice::transporterKey($transporter);
        return DeliveryRate::where('company_id', $companyId)->where('zone', $zone)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->pluck('transporter_name')
            ->contains(fn ($name) => DeliveryInvoice::transporterKey($name) === $key);
    }
}
