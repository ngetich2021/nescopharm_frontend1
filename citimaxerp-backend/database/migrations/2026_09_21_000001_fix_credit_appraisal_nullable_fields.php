<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * These sub-fields were NOT NULL at the DB level while every layer above
     * (API validation, frontend forms) already treated them as optional and
     * sent null when left blank - e.g. a director's PIN, a bank's branch, a
     * supplier's contact person. That mismatch meant saving a credit account
     * with any one of these left blank threw a Postgres not-null violation
     * and silently discarded the entire submission (directors, bank details,
     * credit terms, everything) even though most of the data was valid.
     */
    public function up(): void
    {
        Schema::table('account_directors', function (Blueprint $table) {
            $table->string('id_passport_number')->nullable()->change();
            $table->string('pin')->nullable()->change();
            $table->string('phone_number')->nullable()->change();
        });

        Schema::table('authorised_purchase_persons', function (Blueprint $table) {
            $table->string('phone_number')->nullable()->change();
        });

        Schema::table('account_bank_details', function (Blueprint $table) {
            $table->string('branch')->nullable()->change();
            $table->string('account_number')->nullable()->change();
        });

        Schema::table('account_suppliers', function (Blueprint $table) {
            $table->string('contact_person_name')->nullable()->change();
            $table->string('phone_number')->nullable()->change();
        });

        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->string('company_type')->nullable()->after('certificate_of_incorporation_number');
        });
    }

    public function down(): void
    {
        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->dropColumn('company_type');
        });

        Schema::table('account_suppliers', function (Blueprint $table) {
            $table->string('contact_person_name')->nullable(false)->change();
            $table->string('phone_number')->nullable(false)->change();
        });

        Schema::table('account_bank_details', function (Blueprint $table) {
            $table->string('branch')->nullable(false)->change();
            $table->string('account_number')->nullable(false)->change();
        });

        Schema::table('authorised_purchase_persons', function (Blueprint $table) {
            $table->string('phone_number')->nullable(false)->change();
        });

        Schema::table('account_directors', function (Blueprint $table) {
            $table->string('id_passport_number')->nullable(false)->change();
            $table->string('pin')->nullable(false)->change();
            $table->string('phone_number')->nullable(false)->change();
        });
    }
};
