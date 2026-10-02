<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Captures what was paid to the delivery/logistics provider for a
     * dispatch - the delivery fee itself, not the customer's payment for
     * the goods.
     */
    public function up(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->decimal('delivery_cost', 10, 2)->nullable()->after('logistics_provider');
            $table->decimal('amount_paid', 10, 2)->nullable()->after('delivery_cost');
            $table->string('payment_method')->nullable()->after('amount_paid');
            $table->string('payment_status')->default('unpaid')->after('payment_method');
            $table->string('payment_reference')->nullable()->after('payment_status');
            $table->date('payment_date')->nullable()->after('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->dropColumn(['delivery_cost', 'amount_paid', 'payment_method', 'payment_status', 'payment_reference', 'payment_date']);
        });
    }
};
