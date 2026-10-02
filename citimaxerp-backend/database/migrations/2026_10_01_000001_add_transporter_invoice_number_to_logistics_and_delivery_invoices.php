<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->string('transporter_invoice_number')->nullable()->after('tracking_number');
        });

        Schema::table('delivery_invoices', function (Blueprint $table) {
            $table->string('transporter_invoice_number')->nullable()->after('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->dropColumn('transporter_invoice_number');
        });

        Schema::table('delivery_invoices', function (Blueprint $table) {
            $table->dropColumn('transporter_invoice_number');
        });
    }
};
