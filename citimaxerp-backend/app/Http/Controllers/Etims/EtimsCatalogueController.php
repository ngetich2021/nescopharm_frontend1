<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Jobs\Etims\SyncEtimsItemJob;
use App\Models\ActivityLog;
use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Models\Product;
use App\Services\TaxCompliance\EtimsTaxType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * The eTIMS page: every invoice sent to KRA, and the product list with the KRA codes each product
 * is registered under, exported to Excel, filled in and imported back.
 *
 *   GET  /api/etims/invoices                - invoices that have been sent to eTIMS
 *   GET  /api/etims/products                - active products with their KRA codes
 *   POST /api/etims/products/import         - KRA codes from the exported sheet (dry_run = preview)
 *
 * DigiTax's item update (PUT /items/{id}) only changes name, tax type and price, so a product
 * already registered whose codes change is registered again under the new codes - the same way
 * EtimsItemSyncService replaces an item whose goods/service type changed. Signed invoices keep
 * their own references.
 */
class EtimsCatalogueController extends Controller
{
    // Codes the sync service sends when a product has none of its own (EtimsItemSyncService::registrationDefaults).
    private const GENERIC_CLASS_CODES = ['99010000', '99020000', '99022000'];

    private const CODE_FIELDS = [
        'item_class_code' => 'Item Class Code',
        'packaging_unit_code' => 'Packaging Unit',
        'quantity_unit_code' => 'Quantity Unit',
        'country_of_origin_code' => 'Country of Origin',
    ];

    public function invoices(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $status = $request->query('status');
        $search = trim((string) $request->query('search'));

        $query = Invoice::query()
            ->with('customer:id,name')
            ->where('company_id', $companyId)
            ->whereNotNull('etims_status');
        if ($status) {
            $query->where('etims_status', $status);
        }
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $digits = preg_replace('/\D/', '', $search);
                $q->where('invoice_number', 'ilike', "%{$search}%")
                    ->orWhere('etims_invoice_number', 'ilike', "%{$search}%")
                    ->orWhere('etims_receipt_number', 'ilike', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'ilike', "%{$search}%"));
                if ($digits !== '') {
                    $q->orWhere('file_number', 'ilike', '%'.ltrim($digits, '0').'%');
                }
            });
        }

        $counts = Invoice::query()
            ->where('company_id', $companyId)
            ->whereNotNull('etims_status')
            ->select('etims_status', DB::raw('count(*) as n'))
            ->groupBy('etims_status')
            ->pluck('n', 'etims_status');

        $page = $query
            ->orderByRaw('COALESCE(etims_submitted_at, created_at) DESC')
            ->paginate(min(5000, max(1, (int) $request->query('per_page', 50))));

        return response()->json([
            'data' => collect($page->items())->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'invoice_date' => $invoice->invoice_date?->toDateString(),
                'customer' => $invoice->customer?->name,
                'total_amount' => (float) $invoice->total_amount,
                'etims_status' => $invoice->etims_status,
                'etims_invoice_number' => $invoice->etims_invoice_number,
                'etims_receipt_number' => $invoice->etims_receipt_number,
                'etims_qr_url' => $invoice->etims_qr_url,
                'etims_submitted_at' => $invoice->etims_submitted_at,
                'etims_synced_at' => $invoice->etims_synced_at,
                'etims_last_error' => $invoice->etims_last_error,
            ]),
            'counts' => $counts,
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
        ]);
    }

    /**
     * Everything the eTIMS invoice prints, as KRA lays it out: seller and buyer PINs, the CU
     * invoice number and date, each line under its KRA item code and tax rate, the SCU
     * information (SCU ID, internal data, receipt signature, QR link) and the tax summary.
     */
    public function document(Request $request, string $invoiceId): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $role = $request->user()->role;
        abort_unless($role && collect(['can_view_invoices', 'can_manage_system', 'can_manage_company'])->contains(fn ($p) => $role->hasPermission($p)), 403, 'Unauthorized');

        $invoice = Invoice::with(['customer', 'lineItems.product', 'company'])
            ->where('company_id', $companyId)
            ->findOrFail($invoiceId);
        $config = CompanyEtimsConfig::query()->where('company_id', $companyId)->notSuperseded()->latest()->first();
        $registrations = $this->registrationsFor($companyId, $invoice->lineItems->pluck('product_id')->filter());

        // KRA's rows, in the order its invoice prints them.
        $summaryRows = ['B' => '16%', 'E' => '8%', 'C' => '0%', 'A' => 'Ex.', 'D' => 'Non-VAT'];
        $summary = array_fill_keys(array_keys($summaryRows), ['taxable' => 0.0, 'tax' => 0.0, 'total' => 0.0]);

        $lines = $invoice->lineItems->map(function ($line) use ($registrations, &$summary) {
            $type = EtimsTaxType::forLine($line);
            $profiles = $registrations->get($line->product_id, collect());
            $registration = $profiles->firstWhere('tax_type_code', $type) ?? $profiles->first();
            // KRA applies the tax type the item is registered under, so print that one.
            $type = $registration?->tax_type_code ?: $type;
            $tax = round((float) $line->tax_amount, 2);
            $incl = round((float) $line->line_total, 2);
            $excl = round($incl - $tax, 2);
            $summary[$type]['taxable'] += $excl;
            $summary[$type]['tax'] += $tax;
            $summary[$type]['total'] += $incl;

            return [
                'item_code' => $registration?->item_code,
                'description' => $line->description,
                'quantity' => (float) $line->quantity,
                'unit_price' => (float) $line->unit_price,
                'tax_type' => $type,
                'rate' => match ($type) { 'B' => '16%', 'E' => '8%', 'C' => '0%', 'A' => 'Ex.', default => 'Non-VAT' },
                'amount_excl_tax' => $excl,
                'tax_amount' => $tax,
                'amount_incl_tax' => $incl,
            ];
        })->values();

        // Once signed, the lines and tax summary are KRA's own record of the sale (tax class and
        // KRA item code as KRA holds them), read back from DigiTax; ours only if it can't be reached.
        $source = 'system';
        $sale = $invoice->etims_status === 'completed' ? $this->signedSale($config, $invoice) : null;
        if ($sale && !empty($sale['item_list'])) {
            $source = 'kra';
            $summary = array_fill_keys(array_keys($summaryRows), ['taxable' => 0.0, 'tax' => 0.0, 'total' => 0.0]);
            $descriptions = $invoice->lineItems->pluck('description')->values();
            $lines = collect($sale['item_list'])->values()->map(function ($item, $i) use (&$summary, $descriptions) {
                $type = strtoupper((string) ($item['tax_type_code'] ?? 'D'));
                $tax = round((float) ($item['tax_amount'] ?? 0), 2);
                $incl = round((float) ($item['total_amount'] ?? 0), 2);
                $excl = round((float) ($item['taxable_amount'] ?? ($incl - $tax)), 2);
                if (isset($summary[$type])) {
                    $summary[$type]['taxable'] += $excl;
                    $summary[$type]['tax'] += $tax;
                    $summary[$type]['total'] += $incl;
                }

                return [
                    'item_code' => $item['etims_item_code'] ?? null,
                    'description' => $item['item_description'] ?? $item['description'] ?? $descriptions[$i] ?? '',
                    'quantity' => (float) ($item['quantity'] ?? 0),
                    'unit_price' => (float) ($item['unit_price'] ?? 0),
                    'tax_type' => $type,
                    'rate' => match ($type) { 'B' => '16%', 'E' => '8%', 'C' => '0%', 'A' => 'Ex.', default => 'Non-VAT' },
                    'amount_excl_tax' => $excl,
                    'tax_amount' => $tax,
                    'amount_incl_tax' => $incl,
                ];
            });
        }

        $summaryOut = [];
        foreach ($summaryRows as $type => $label) {
            // Non-VAT only shows when the invoice has such lines; KRA's four rows always show.
            if ($type === 'D' && $summary['D']['total'] == 0.0) {
                continue;
            }
            $summaryOut[] = ['rate' => $label] + array_map(fn ($v) => round($v, 2), $summary[$type]);
        }

        $receiptDate = trim(($invoice->etims_receipt_date ?? '').' '.($invoice->etims_receipt_time ?? ''));
        // KRA prints the CU invoice number as SCU ID / invoice count (KRACU0200099406/423);
        // DigiTax returns the two apart.
        $cuNumber = $invoice->etims_invoice_number;
        if ($cuNumber !== null && !str_contains((string) $cuNumber, '/') && $invoice->etims_serial_number) {
            $cuNumber = $invoice->etims_serial_number.'/'.$cuNumber;
        }

        return response()->json([
            'invoice_id' => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'etims_status' => $invoice->etims_status,
            'etims_last_error' => $invoice->etims_last_error,
            'environment' => $config?->environment,
            // 'kra': lines and summary as KRA recorded them; 'system': from this invoice.
            'source' => $source,
            'seller' => ['pin' => $config?->kra_pin, 'name' => $invoice->company?->name],
            'buyer' => [
                'pin' => trim((string) $invoice->customer?->pin_number) ?: null,
                'name' => $invoice->customer ? ($invoice->customer->business_name ?: $invoice->customer->name) : null,
            ],
            'cu_invoice_number' => $cuNumber,
            'receipt_number' => $invoice->etims_receipt_number,
            'date' => $receiptDate !== '' ? $receiptDate : ($invoice->etims_synced_at?->format('d/m/Y H:i:s')),
            'scu_id' => $invoice->etims_serial_number,
            'internal_data' => $invoice->etims_internal_data,
            'receipt_signature' => $invoice->etims_signature,
            'qr_url' => $invoice->etims_qr_url,
            'lines' => $lines,
            'tax_summary' => $summaryOut,
            'totals' => [
                'taxable' => round(array_sum(array_column($summary, 'taxable')), 2),
                'tax' => round(array_sum(array_column($summary, 'tax')), 2),
                'total' => round(array_sum(array_column($summary, 'total')), 2),
            ],
        ]);
    }

    /** The signed sale as DigiTax holds it (GET /sales/{id}), or null when it can't be read. */
    private function signedSale(?CompanyEtimsConfig $config, Invoice $invoice): ?array
    {
        if (!$config || !$invoice->etims_sale_id || !$config->hasApiKey()) {
            return null;
        }
        try {
            $response = app(\App\Services\TaxCompliance\Providers\Kenya\EtimsClient::class)
                ->get($config, '/sales/'.$invoice->etims_sale_id, [], 'sale.document');
            if (!$response->successful()) {
                return null;
            }
            $body = $response->json() ?? [];

            return is_array($body['data'] ?? null) ? $body['data'] : $body;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('eTIMS document: could not read the signed sale', ['invoice' => $invoice->id, 'error' => $e->getMessage()]);

            return null;
        }
    }

    public function products(Request $request): JsonResponse
    {
        $companyId = $this->resolveActiveCompanyId();
        $products = Product::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
        $registrations = $this->registrationsFor($companyId, $products->pluck('id'));

        return response()->json([
            'data' => $products->map(fn (Product $product) => $this->productRow(
                $product,
                $registrations->get($product->id, collect()),
            ))->values(),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
            'dry_run' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $user = $request->user();
        $role = $user->role;
        $allowed = $role && ($role->hasPermission('can_manage_system')
            || $role->hasPermission('can_manage_company')
            || $role->hasPermission('can_update_products'));
        if (! $allowed) {
            return response()->json(['status' => 'failed', 'message' => 'You do not have permission to change product KRA codes.'], 403);
        }

        try {
            $rows = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath())
                ->getSheet(0)
                ->toArray(null, true, false, false);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'failed', 'message' => 'Could not read the file: '.$e->getMessage()], 422);
        }

        // The Excel export puts the letterhead and title above the headings, so find the heading row.
        [$headingRow, $columns] = $this->findHeadings($rows);
        if ($headingRow === null) {
            return response()->json([
                'status' => 'failed',
                'message' => 'This sheet has no "Item Description" and "Item Class Code" headings. Export the product list from eTIMS > Product Codes, fill in the codes and upload that file.',
            ], 422);
        }

        $companyId = $this->resolveActiveCompanyId();
        $dryRun = $request->boolean('dry_run');
        $products = Product::query()->where('company_id', $companyId)->get();
        $byId = $products->keyBy('id');
        $byName = $products->groupBy(fn (Product $p) => $this->nameKey($p->name));
        $registrations = $this->registrationsFor($companyId, $products->pluck('id'));

        $results = [];
        $toSync = [];
        $seen = [];
        $summary = ['rows' => 0, 'updated' => 0, 'unchanged' => 0, 'reregistered' => 0, 'errors' => 0];

        DB::beginTransaction();
        try {
            foreach (array_slice($rows, $headingRow + 1, null, true) as $index => $row) {
                $cell = fn (string $key) => isset($columns[$key])
                    ? trim(preg_replace('/\s+/', ' ', (string) ($row[$columns[$key]] ?? '')))
                    : '';
                $name = $cell('name');
                $ref = $cell('ref');
                if ($name === '' && $ref === '') {
                    continue;
                }
                $summary['rows']++;
                $result = ['row' => $index + 1, 'key' => $ref, 'name' => $name, 'unit' => $cell('unit'), 'status' => 'unchanged', 'changes' => [], 'message' => null, 'reregister' => false];

                [$product, $error] = $this->matchProduct($ref, $name, $cell('unit'), $byId, $byName);
                if (! $product) {
                    $results[] = ['status' => 'error', 'message' => $error] + $result;
                    $summary['errors']++;

                    continue;
                }
                $result['name'] = $product->name;
                $result['unit'] = $product->unit_of_measurement;
                if (isset($seen[$product->id])) {
                    $results[] = ['status' => 'error', 'message' => "Same product as row {$seen[$product->id]}; only the first row is used."] + $result;
                    $summary['errors']++;

                    continue;
                }
                $seen[$product->id] = $index + 1;

                [$codes, $error] = $this->readCodes($cell);
                if ($error) {
                    $results[] = ['status' => 'error', 'message' => $error] + $result;
                    $summary['errors']++;

                    continue;
                }

                $profiles = $registrations->get($product->id, collect());
                $current = $this->effectiveCodes($product, $profiles);
                $changes = [];
                foreach ($codes as $field => $value) {
                    if ($value !== null && $value !== $current[$field]) {
                        $changes[] = ['field' => self::CODE_FIELDS[$field], 'from' => $current[$field], 'to' => $value];
                    }
                }
                if ($changes === []) {
                    $results[] = $result;
                    $summary['unchanged']++;

                    continue;
                }

                $reregister = $this->applyCodes($companyId, $product, $profiles, array_filter($codes, fn ($v) => $v !== null));
                $results[] = ['status' => 'updated', 'changes' => $changes, 'reregister' => $reregister] + $result;
                $summary['updated']++;
                if ($reregister) {
                    $summary['reregistered']++;
                    $toSync[] = (string) $product->id;
                }
            }
            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json(['status' => 'failed', 'message' => 'The import stopped and nothing was saved: '.$e->getMessage()], 500);
        }

        if (! $dryRun) {
            $this->recordImport($request, $user, $summary, $results);
            $this->queueRegistrations($companyId, $toSync);
        }

        return response()->json([
            'status' => 'success',
            'message' => $dryRun ? 'Preview only - nothing was saved.' : 'KRA codes imported.',
            'dry_run' => $dryRun,
            'summary' => $summary,
            'rows' => $results,
        ]);
    }

    /** @return Collection<string, Collection<int, EtimsItemRegistration>> */
    private function registrationsFor(string $companyId, Collection $productIds): Collection
    {
        return EtimsItemRegistration::query()
            ->where('company_id', $companyId)
            ->whereIn('product_id', $productIds)
            ->get()
            ->groupBy('product_id');
    }

    private function productRow(Product $product, Collection $profiles): array
    {
        $codes = $this->effectiveCodes($product, $profiles);
        $statuses = $profiles->pluck('sync_status')->unique();
        $status = $profiles->isEmpty() ? 'not_registered'
            : ($statuses->contains(EtimsItemRegistration::STATUS_FAILED) ? 'failed'
            : ($statuses->every(fn ($s) => $s === EtimsItemRegistration::STATUS_SYNCED) ? 'synced' : 'pending'));

        return [
            'id' => $product->id,
            'name' => $product->name,
            'unit' => $product->unit_of_measurement,
            'type' => $product->type === 'service' ? 'Service' : 'Goods',
            'tax_type' => EtimsTaxType::forProduct($product),
            'tax_label' => EtimsTaxType::label(EtimsTaxType::forProduct($product)),
            'generic_class_code' => in_array($codes['item_class_code'], self::GENERIC_CLASS_CODES, true),
            'kra_status' => $status,
            'kra_item_codes' => $profiles->pluck('item_code')->filter()->unique()->values(),
            'last_error' => $profiles->pluck('last_error')->filter()->first(),
        ] + $codes;
    }

    /** The codes KRA gets for this product: its own, else its registration's, else the sync defaults. */
    private function effectiveCodes(Product $product, Collection $profiles): array
    {
        $main = $profiles->firstWhere('tax_type_code', EtimsTaxType::forProduct($product)) ?? $profiles->first();
        $isService = $product->type === 'service';

        return [
            'item_class_code' => $product->etims_item_class_code
                ?: ($main?->item_class_code ?: ($isService ? '99020000' : '99010000')),
            'packaging_unit_code' => $main?->packaging_unit_code ?: 'NT',
            'quantity_unit_code' => $main?->quantity_unit_code ?: 'U',
            'country_of_origin_code' => $main?->country_of_origin_code ?: 'KE',
        ];
    }

    /**
     * Writes the codes to the product and every eTIMS profile it has (one is created when it has
     * none, so the codes are used at its first registration). Returns whether a profile already
     * registered with KRA has to be registered again.
     */
    private function applyCodes(string $companyId, Product $product, Collection $profiles, array $codes): bool
    {
        if (isset($codes['item_class_code'])) {
            $product->etims_item_class_code = $codes['item_class_code'];
            $product->save();
        }

        if ($profiles->isEmpty()) {
            $profiles = collect([EtimsItemRegistration::firstOrCreate(
                ['company_id' => $companyId, 'product_id' => $product->id, 'tax_type_code' => EtimsTaxType::forProduct($product)],
                ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
            )]);
        }

        $reregister = false;
        foreach ($profiles as $registration) {
            $registration->fill($codes);
            if (! $registration->isDirty()) {
                continue;
            }
            if (filled($registration->digitax_item_id)) {
                $reregister = true;
                $registration->forceFill([
                    'digitax_item_id' => null,
                    'item_code' => null,
                    'client_request_id' => null,
                    'sync_status' => EtimsItemRegistration::STATUS_PENDING,
                    'synced_at' => null,
                    'last_attempt_at' => null,
                    'last_error' => null,
                    'attempts' => 0,
                ]);
            }
            $registration->save();
        }

        return $reregister;
    }

    /** Each code as written in the sheet (upper case), null when left blank, or the first invalid one. */
    private function readCodes(\Closure $cell): array
    {
        $codes = [];
        $rules = [
            'item_class_code' => ['/^\d{8}$/', 'Item Class Code must be the 8-digit KRA code, e.g. 42142600'],
            'packaging_unit_code' => ['/^[A-Z0-9]{1,5}$/', 'Packaging Unit must be a KRA packaging code, e.g. BX (box) or NT (net)'],
            'quantity_unit_code' => ['/^[A-Z0-9]{1,5}$/', 'Quantity Unit must be a KRA quantity code, e.g. U (pieces) or KG'],
            'country_of_origin_code' => ['/^[A-Z]{2}$/', 'Country of Origin must be a 2-letter code, e.g. KE or CN'],
        ];
        foreach ($rules as $field => [$pattern, $message]) {
            $value = strtoupper(str_replace(' ', '', $cell($field)));
            // Excel can turn an 8-digit code into 42142600.0
            if ($field === 'item_class_code') {
                $value = preg_replace('/\.0+$/', '', $value);
            }
            if ($value === '') {
                $codes[$field] = null;

                continue;
            }
            if (! preg_match($pattern, $value)) {
                return [null, "{$message} (found \"{$cell($field)}\")."];
            }
            $codes[$field] = $value;
        }

        return [$codes, null];
    }

    /** By the hidden Ref the export writes, else by description (and unit of measure when two share it). */
    private function matchProduct(string $ref, string $name, string $unit, Collection $byId, Collection $byName): array
    {
        if ($ref !== '' && $byId->has($ref)) {
            return [$byId->get($ref), null];
        }

        $candidates = $byName->get($this->nameKey($name), collect());
        if ($candidates->count() > 1) {
            $active = $candidates->where('is_active', true);
            $candidates = $active->isNotEmpty() ? $active : $candidates;
        }
        if ($candidates->count() > 1 && $unit !== '') {
            $candidates = $candidates->filter(fn (Product $p) => $this->nameKey((string) $p->unit_of_measurement) === $this->nameKey($unit));
        }

        return match ($candidates->count()) {
            1 => [$candidates->first(), null],
            0 => [null, $name === '' ? 'No Item Description.' : "No product is called \"{$name}\"."],
            default => [null, "More than one product is called \"{$name}\"; rename one on the Products page first."],
        };
    }

    // "29 g", "29g" and "29G" are the same description.
    private function nameKey(?string $name): string
    {
        return preg_replace('/\s+/', '', Str::lower((string) $name));
    }

    /** @return array{0: ?int, 1: array<string, int>} */
    private function findHeadings(array $rows): array
    {
        $aliases = [
            'name' => ['itemdescription', 'description', 'product', 'productname'],
            'unit' => ['unitofmeasure', 'unit', 'uom'],
            'item_class_code' => ['itemclasscode', 'kraitemclasscode', 'classcode'],
            'packaging_unit_code' => ['packagingunit', 'packagingunitcode', 'packageunit', 'packageunitcode'],
            'quantity_unit_code' => ['quantityunit', 'quantityunitcode'],
            'country_of_origin_code' => ['countryoforigin', 'countryoforigincode', 'origin'],
            'ref' => ['ref'],
        ];
        foreach (array_slice($rows, 0, 60, true) as $index => $row) {
            $columns = [];
            foreach ($row as $col => $heading) {
                $key = preg_replace('/[^a-z]/', '', Str::lower((string) $heading));
                foreach ($aliases as $field => $names) {
                    if (! isset($columns[$field]) && in_array($key, $names, true)) {
                        $columns[$field] = $col;
                    }
                }
            }
            if (isset($columns['name'], $columns['item_class_code'])) {
                return [$index, $columns];
            }
        }

        return [null, []];
    }

    /** Same history entry as the other imports, shown by the Import History dialog (kind etims_codes). */
    private function recordImport(Request $request, $user, array $summary, array $results): void
    {
        $file = $request->file('file');
        $path = \App\Services\ImportFileStore::store($file, "imports/{$user->company_id}", 'etims_codes_'.now()->format('Ymd_His').'_'.Str::random(6).'.'.$file->getClientOriginalExtension());

        ActivityLog::logActivity('etims_codes_import', 'KRA product codes imported from '.$file->getClientOriginalName(), $user, [
            'kind' => 'etims_codes',
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'summary' => [
                'rows' => $summary['rows'],
                'items_updated' => $summary['updated'],
                'reregistered' => $summary['reregistered'],
                'unchanged' => $summary['unchanged'],
                'errors' => $summary['errors'],
            ],
            'changes' => array_values(array_map(fn ($r) => [
                'ref' => (string) $r['row'],
                'item' => $r['name'],
                'size' => $r['unit'] ?: null,
                'action' => $r['status'],
                'changes' => $r['status'] === 'error'
                    ? [['field' => 'result', 'from' => null, 'to' => $r['message']]]
                    : array_merge($r['changes'], $r['reregister'] ? [['field' => 'KRA', 'from' => null, 'to' => 'registered again under the new codes']] : []),
            ], array_filter($results, fn ($r) => $r['status'] !== 'unchanged'))),
        ]);
    }

    /** Registers the products again now rather than at their next invoice, when eTIMS is switched on. */
    private function queueRegistrations(string $companyId, array $productIds): void
    {
        if ($productIds === []) {
            return;
        }
        $enabled = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->notSuperseded()
            ->whereRaw('enabled = true')
            ->exists();
        if (! $enabled) {
            return;
        }
        foreach ($productIds as $productId) {
            SyncEtimsItemJob::dispatch($companyId, $productId);
        }
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
