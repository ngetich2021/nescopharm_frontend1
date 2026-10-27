<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A bounced customer cheque raises a charge invoice (bounced cheque charges) for the customer
 * to pay. Recorded on the cheque so the charge is raised once and can be found from the cheque.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            if (!Schema::hasColumn('cheques', 'bounce_charge_invoice_id')) {
                $table->uuid('bounce_charge_invoice_id')->nullable()->after('payment_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropColumn('bounce_charge_invoice_id');
        });
    }
};
