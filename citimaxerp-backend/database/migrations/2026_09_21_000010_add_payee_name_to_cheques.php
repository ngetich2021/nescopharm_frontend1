<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Not every cheque the company issues goes to a registered supplier or
     * a customer refund - office supplies, logistics/courier fees, and
     * other ad-hoc payees don't necessarily have a master record. This is
     * a free-text fallback name for those.
     */
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->string('payee_name')->nullable()->after('supplier_id');
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropColumn('payee_name');
        });
    }
};
