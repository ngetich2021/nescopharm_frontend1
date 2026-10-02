<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Snapshot of the customer's payment method / credit terms at the time this
            // invoice was created, so later edits to the customer don't rewrite history.
            $table->string('payment_type', 10)->default('cash')->after('customer_id');
            $table->unsignedInteger('credit_terms_days')->nullable()->after('payment_type');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['payment_type', 'credit_terms_days']);
        });
    }
};
