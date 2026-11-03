<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Models\InvoiceLineItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\TaxCompliance\EtimsSaleAmountAllocator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

/**
 * eTIMS > Lines to link: invoice lines that are not on a live product (an old line written for a
 * product since deleted, which the name match could not place on exactly one product). Such an
 * invoice is not sent to KRA until each of its lines is linked to the right existing product.
 * Linking only changes which product the line names - it never moves stock (a past-dated invoice
 * never touched stock in the first place).
 *
 *   GET  /api/etims/unlinked-lines             - the lines, and the products to pick from
 *   POST /api/etims/unlinked-lines/{id}/link   - {product_id, variant_id?, same_text?}
 */
class EtimsUnlinkedLinesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->denied($request)) {
            return $denied;
        }
        $companyId = $this->companyId();

        $lines = $this->unlinkedQuery($companyId)
            ->with(['invoice:id,invoice_number,file_number,invoice_date,customer_id,order_id,etims_status', 'invoice.customer:id,name,business_name'])
            ->get()
            ->sortBy(fn (InvoiceLineItem $l) => [$l->invoice?->invoice_date?->toDateString(), $l->invoice?->invoice_number])
            ->values();
        $historicalOrders = Order::whereIn('id', $lines->pluck('invoice.order_id')->filter()->unique())
            ->whereRaw('is_historical = true')->pluck('id')->flip();

        return response()->json([
            'data' => $lines->map(fn (InvoiceLineItem $l) => [
                'id' => $l->id,
                'description' => $l->description,
                'quantity' => (float) $l->quantity,
                'unit_price' => (float) $l->unit_price,
                'invoice_id' => $l->invoice_id,
                'invoice_number' => $l->invoice?->invoice_number,
                'invoice_date' => $l->invoice?->invoice_date?->toDateString(),
                'customer' => $l->invoice?->customer ? ($l->invoice->customer->business_name ?: $l->invoice->customer->name) : null,
                // Past (pre-go-live) sales never moved stock, so linking them cannot either.
                'past_dated' => ($l->invoice?->order_id && $historicalOrders->has($l->invoice->order_id))
                    || Order::isHistoricalDate($l->invoice?->invoice_date),
                'etims_status' => $l->invoice?->etims_status,
            ])->values(),
            'products' => $this->productOptions($companyId),
        ]);
    }

    public function link(Request $request, string $lineId): JsonResponse
    {
        if ($denied = $this->denied($request)) {
            return $denied;
        }
        $companyId = $this->companyId();
        $validator = Validator::make($request->all(), [
            'product_id' => 'required|uuid',
            'variant_id' => 'nullable|uuid',
            'same_text' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }

        $line = $this->unlinkedQuery($companyId)->find($lineId);
        if (! $line) {
            return response()->json(['message' => 'This line is already linked, or is not one of yours.'], 404);
        }
        $product = Product::where('company_id', $companyId)->catalogue()->find($request->input('product_id'));
        if (! $product) {
            return response()->json(['message' => 'Pick one of your products.'], 422);
        }
        $variant = $request->filled('variant_id')
            ? ProductVariant::where('product_id', $product->id)->find($request->input('variant_id'))
            : null;
        if ($request->filled('variant_id') && ! $variant) {
            return response()->json(['message' => 'That size is not one of this product\'s sizes.'], 422);
        }

        // Every unlinked line written the same way (e.g. 34 "Crepe Bandage 4\" ... (7.5cm ...)") in one go.
        $targets = $request->boolean('same_text')
            ? $this->unlinkedQuery($companyId)->where('description', $line->description)->get()
            : collect([$line]);
        foreach ($targets as $target) {
            // Only the product the line names changes; no stock is moved.
            $target->forceFill(['product_id' => $product->id, 'variant_id' => $variant?->id])->saveQuietly();
        }

        $name = ProductVariant::sizedName($product->name, $variant?->name);

        return response()->json([
            'message' => $targets->count() === 1
                ? "Linked to {$name}."
                : "{$targets->count()} lines linked to {$name}.",
            'linked' => $targets->count(),
        ]);
    }

    /** Lines of this company's invoices with no product, a deleted one, or one the eTIMS sync made. */
    private function unlinkedQuery(string $companyId)
    {
        $live = Product::withoutGlobalScope('company')
            ->where('company_id', $companyId)
            ->where(fn ($q) => $q->whereNull('product_code')->orWhere('product_code', 'not like', 'ETIMS-AUTO-%'))
            ->select('id');

        return InvoiceLineItem::query()
            ->whereHas('invoice', fn ($q) => $q->where('company_id', $companyId))
            ->where(fn ($q) => $q->whereNull('product_id')->orWhereNotIn('product_id', $live));
    }

    /** @return array<int, array{product_id: string, variant_id: ?string, name: string}> */
    private function productOptions(string $companyId): array
    {
        $products = Product::where('company_id', $companyId)->catalogue()
            ->where(fn ($q) => $q->whereNull('product_code')->orWhere('product_code', 'not like', 'ETIMS-%'))
            ->orderBy('name')->get(['id', 'name']);
        $variants = ProductVariant::whereIn('product_id', $products->pluck('id'))->get(['id', 'product_id', 'name'])->groupBy('product_id');

        $options = [];
        foreach ($products as $product) {
            $sizes = $variants->get($product->id, collect());
            if ($sizes->isEmpty()) {
                $options[] = ['product_id' => $product->id, 'variant_id' => null, 'name' => $product->name];
            }
            foreach ($sizes as $size) {
                $options[] = ['product_id' => $product->id, 'variant_id' => $size->id, 'name' => ProductVariant::sizedName($product->name, $size->name)];
            }
        }

        return $options;
    }

    private function denied(Request $request): ?JsonResponse
    {
        $role = $request->user()?->role;
        $allowed = $role && ($role->hasPermission('can_manage_system')
            || $role->hasPermission('can_manage_company')
            || $role->hasPermission('can_update_invoices'));

        return $allowed ? null : response()->json(['message' => 'You do not have permission to change invoice lines.'], 403);
    }

    private function companyId(): string
    {
        if (function_exists('active_company_id') && ($id = active_company_id())) {
            return (string) $id;
        }
        $user = Auth::user();
        if ($user && $user->company_id) {
            return (string) $user->company_id;
        }
        abort(403, 'Cannot resolve active company.');
    }
}
