<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Delivery invoices can be brought in from Excel for deliveries made before the system (no dispatch
 * to point at), each transporter is a supplier (so paying one shows under Payments and on that
 * supplier's statement), and an invoice keeps its own date and the payment that settled it.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Old records may have no dispatch, delivery rate, zone or carton count - only an amount.
        foreach (['order_dispatch_id', 'delivery_rate_id', 'zone', 'number_of_cartons', 'rate_per_carton'] as $column) {
            DB::statement("ALTER TABLE delivery_invoices ALTER COLUMN {$column} DROP NOT NULL");
        }

        Schema::table('delivery_invoices', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_invoices', 'supplier_id')) {
                $table->uuid('supplier_id')->nullable()->index();
            }
            if (!Schema::hasColumn('delivery_invoices', 'invoice_date')) {
                $table->date('invoice_date')->nullable();
            }
            if (!Schema::hasColumn('delivery_invoices', 'supplier_payment_id')) {
                $table->uuid('supplier_payment_id')->nullable();
            }
            if (!Schema::hasColumn('delivery_invoices', 'order_reference')) {
                // Order / customer / destination as written in the old records, when there is no dispatch.
                $table->string('order_reference')->nullable();
            }
        });

        DB::statement('UPDATE delivery_invoices SET invoice_date = created_at::date WHERE invoice_date IS NULL');
    }

    public function down(): void
    {
        Schema::table('delivery_invoices', function (Blueprint $table) {
            foreach (['supplier_id', 'invoice_date', 'supplier_payment_id', 'order_reference'] as $column) {
                if (Schema::hasColumn('delivery_invoices', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
