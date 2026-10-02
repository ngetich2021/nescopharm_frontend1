<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * `cheques.payment_id` has always had an FK to `payments` - the table
     * used for customer/order payments. A supplier cheque's linked record is
     * a `SupplierPayment` (a different table entirely), so writing its id
     * into `payment_id` violates that FK. This gives issued supplier cheques
     * their own properly-typed column instead of overloading `payment_id`.
     */
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->uuid('supplier_payment_id')->nullable()->after('payment_id')
                ->comment('Set once an issued supplier cheque is approved/cleared');

            $table->foreign('supplier_payment_id')->references('id')->on('supplier_payments')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropForeign(['supplier_payment_id']);
            $table->dropColumn('supplier_payment_id');
        });
    }
};
