<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Same idea as cheques.supplier_payment_id: a customer-refund cheque
     * needs its own properly-typed link back to the PaymentRefund it clears,
     * distinct from cheques.payment_id (invoice payments) and
     * supplier_payment_id (supplier payments).
     */
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->uuid('payment_refund_id')->nullable()->after('supplier_payment_id')
                ->comment('Set once an issued customer-refund cheque is approved/cleared');

            $table->foreign('payment_refund_id')->references('id')->on('payment_refunds')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropForeign(['payment_refund_id']);
            $table->dropColumn('payment_refund_id');
        });
    }
};
