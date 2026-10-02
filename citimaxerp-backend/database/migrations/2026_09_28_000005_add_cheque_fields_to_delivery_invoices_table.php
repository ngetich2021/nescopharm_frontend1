<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_invoices', function (Blueprint $table) {
            $table->string('cheque_number')->nullable()->after('payment_reference');
            $table->string('bank_name')->nullable()->after('cheque_number');
            $table->date('cheque_maturity_date')->nullable()->after('bank_name');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_invoices', function (Blueprint $table) {
            $table->dropColumn(['cheque_number', 'bank_name', 'cheque_maturity_date']);
        });
    }
};
