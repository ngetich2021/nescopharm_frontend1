<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('etims_receipt_number')->nullable()->after('etims_trader_invoice_number');
            $table->string('etims_serial_number')->nullable()->after('etims_receipt_number');
            $table->string('etims_invoice_number')->nullable()->after('etims_serial_number');
            $table->string('etims_receipt_date', 32)->nullable()->after('etims_invoice_number');
            $table->string('etims_receipt_time', 32)->nullable()->after('etims_receipt_date');
            $table->text('etims_internal_data')->nullable()->after('etims_receipt_time');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'etims_receipt_number',
                'etims_serial_number',
                'etims_invoice_number',
                'etims_receipt_date',
                'etims_receipt_time',
                'etims_internal_data',
            ]);
        });
    }
};
