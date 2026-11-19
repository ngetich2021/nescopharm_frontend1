<?php

use App\Models\DeliveryInvoice;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Delivery invoices with no rate (imported from the old system, or whose rate was deleted) are linked
 * to the transporter's rate charged at the same price per carton, which gives them their zone
 * (e.g. Imevo Limited KES 290 = Upcountry, KES 200 = Nairobi). Only when exactly one rate fits.
 */
return new class extends Migration
{
    public function up(): void
    {
        $rates = DB::table('delivery_rates')->get(['id', 'company_id', 'transporter_name', 'zone', 'rate_per_carton']);

        DB::table('delivery_invoices')->whereNull('delivery_rate_id')->whereNotNull('rate_per_carton')
            ->orderBy('id')->get(['id', 'company_id', 'transporter_name', 'zone', 'rate_per_carton'])
            ->each(function ($invoice) use ($rates) {
                $key = DeliveryInvoice::transporterKey($invoice->transporter_name);
                $fits = $rates->filter(fn ($r) => $r->company_id === $invoice->company_id
                    && DeliveryInvoice::transporterKey($r->transporter_name) === $key
                    && abs((float) $r->rate_per_carton - (float) $invoice->rate_per_carton) < 0.005
                    && (!$invoice->zone || $r->zone === $invoice->zone));
                if ($fits->count() !== 1) {
                    return;
                }
                $rate = $fits->first();
                DB::table('delivery_invoices')->where('id', $invoice->id)
                    ->update(['delivery_rate_id' => $rate->id, 'zone' => $invoice->zone ?: $rate->zone]);
            });
    }

    public function down(): void
    {
        // Links only; nothing to undo.
    }
};
