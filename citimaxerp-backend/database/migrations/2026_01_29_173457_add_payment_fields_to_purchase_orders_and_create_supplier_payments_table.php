<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->decimal('total_amount', 15, 2)->default(0)->after('status');
            $table->decimal('amount_paid', 15, 2)->default(0)->after('total_amount');
            $table->string('payment_status')->default('unpaid')->after('amount_paid');
        });

        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('supplier_id');
            $table->uuid('purchase_order_id')->nullable();
            $table->string('payment_number')->unique();
            $table->decimal('amount', 15, 2);
            $table->date('payment_date');
            $table->string('payment_method');
            $table->string('transaction_reference')->nullable();
            $table->string('status')->default('completed');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies');
            $table->foreign('supplier_id')->references('id')->on('suppliers');
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_payments');

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['total_amount', 'amount_paid', 'payment_status']);
        });
    }
};
