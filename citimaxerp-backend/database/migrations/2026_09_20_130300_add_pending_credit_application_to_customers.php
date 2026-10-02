<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A rep captures the full credit-application data (directors, trade
 * references, bank details, requested turnover/credit terms) at customer
 * creation time, before any CustomerAccount exists (account_directors/
 * account_suppliers/account_bank_details all require an existing
 * customer_account_id, which doesn't exist yet at this point). It's held here
 * as structured JSON and materialized into the real CustomerAccount +
 * AccountDirector/AccountSupplier/AccountBankDetail rows on Stage 1 approval.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->jsonb('pending_credit_application')->nullable()->after('accounts_contact_email');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('pending_credit_application');
        });
    }
};
