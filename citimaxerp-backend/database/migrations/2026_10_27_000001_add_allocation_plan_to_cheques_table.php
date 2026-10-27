<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A PD cheque received on a customer's account (not against one invoice) carries how it is
     * meant to be spread over their invoices: [{invoice_id, invoice_number, amount}]. It is
     * applied when the cheque is approved.
     */
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->json('allocation_plan')->nullable()->after('invoice_id');
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropColumn('allocation_plan');
        });
    }
};
