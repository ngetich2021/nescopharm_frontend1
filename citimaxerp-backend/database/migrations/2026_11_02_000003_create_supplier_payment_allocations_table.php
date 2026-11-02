<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which supplier invoices a supplier payment pays: a supplier bill (accounts_payable) or a transporter's
 * delivery invoice. One payment (e.g. one cheque) can pay many invoices, and one invoice can be paid by
 * several payments. applied_at is set once the amount is on the invoice - a cheque only applies when it clears.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('supplier_payment_allocations')) {
            return;
        }

        Schema::create('supplier_payment_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('supplier_payment_id')->index();
            $table->string('invoice_type', 20); // 'bill' or 'delivery_invoice'
            $table->uuid('invoice_id');
            $table->decimal('amount', 15, 2);
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();

            $table->index(['invoice_type', 'invoice_id']);
            $table->foreign('supplier_payment_id')->references('id')->on('supplier_payments')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_payment_allocations');
    }
};
