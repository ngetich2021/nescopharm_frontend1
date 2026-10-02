<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Tracks cash already refunded off a Payment's excess (e.g. a customer
     * overpaid an invoice and got the difference back) - lets
     * "available to refund" be computed as amount_paid - allocated - refunded,
     * so the same excess can't be refunded twice.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('amount_refunded', 10, 2)->default(0)->after('amount_paid');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('amount_refunded');
        });
    }
};
