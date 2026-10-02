<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the fields needed to capture Nescopharm's paper "Credit Appraisal Form"
 * digitally, on top of the customer/account tables that already cover most of
 * it (directors, trade-reference suppliers, bank details already exist).
 *
 * Also grandfathers every existing customer to approval_status='approved' -
 * that column has existed since the customers table was created but has never
 * been read or written by any code, so every current row is still sitting at
 * the default 'draft'. Once approval_status starts being enforced (customer
 * search/pickers filtering to 'approved'), every pre-existing customer must
 * already be 'approved' or the whole CRM breaks on deploy. This must run
 * before that enforcement goes live.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('trading_name')->nullable()->after('business_name');
            $table->string('business_type')->nullable()->after('trading_name'); // pharmacy|hospital_clinic|distributor|ngo|other
            $table->string('registration_number')->nullable()->after('business_type');
            $table->string('ppb_license_number')->nullable()->after('registration_number');
            $table->string('website')->nullable()->after('ppb_license_number');
            $table->string('telephone')->nullable()->after('phone');
            $table->string('region')->nullable()->after('country'); // Kenya province, narrows county
            $table->string('county')->nullable()->after('region');
            // Distinct "Accounts Contact" block - the form has two separate contacts
            // (Primary/Procurement and Accounts), but customers only ever had one.
            $table->string('accounts_contact_name')->nullable()->after('contact_person_email');
            $table->string('accounts_contact_designation')->nullable()->after('accounts_contact_name');
            $table->string('accounts_contact_phone')->nullable()->after('accounts_contact_designation');
            $table->string('accounts_contact_email')->nullable()->after('accounts_contact_phone');
        });

        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->integer('credit_period_pd_cheque_days')->nullable()->after('credit_period_required');
        });

        Schema::table('account_bank_details', function (Blueprint $table) {
            $table->string('account_name')->nullable()->after('bank_name');
        });

        // Grandfather every existing customer in before approval_status enforcement
        // is wired up anywhere in the app.
        DB::table('customers')
            ->where(function ($q) {
                $q->where('approval_status', 'draft')->orWhereNull('approval_status');
            })
            ->update(['approval_status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'trading_name',
                'business_type',
                'registration_number',
                'ppb_license_number',
                'website',
                'telephone',
                'region',
                'county',
                'accounts_contact_name',
                'accounts_contact_designation',
                'accounts_contact_phone',
                'accounts_contact_email',
            ]);
        });

        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->dropColumn('credit_period_pd_cheque_days');
        });

        Schema::table('account_bank_details', function (Blueprint $table) {
            $table->dropColumn('account_name');
        });
    }
};
