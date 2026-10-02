<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('order_dispatch_id');
            $table->uuid('delivery_rate_id');
            $table->string('invoice_number')->unique(); // Auto-generated DI-0001, etc.
            $table->string('transporter_name');
            $table->string('zone'); // nairobi, upcountry
            $table->integer('number_of_cartons');
            $table->decimal('rate_per_carton', 10, 2);
            $table->decimal('total_amount', 12, 2); // Calculated: cartons × rate
            $table->string('status')->default('pending'); // pending, paid, cancelled
            $table->string('payment_method')->nullable(); // cash, mpesa, bank_transfer, etc.
            $table->string('payment_reference')->nullable(); // M-Pesa code, cheque number, etc.
            $table->timestamp('payment_date')->nullable();
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->uuid('paid_by')->nullable(); // Accountant who paid
            $table->text('notes')->nullable();
            $table->uuid('created_by'); // Warehouse manager who created
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('order_dispatch_id')->references('id')->on('order_dispatches')->cascadeOnDelete();
            $table->foreign('delivery_rate_id')->references('id')->on('delivery_rates')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('paid_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_invoices');
    }
};
