<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Section 8 "For Official Use Only" of the Credit Appraisal Form needs to
 * show who actually reviewed/approved the account and in what capacity -
 * captured as plain text at save time (not a live lookup of the current
 * viewer), so it stays historically accurate no matter who views it later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->string('reviewed_by_name')->nullable()->after('notes');
            $table->string('reviewed_by_position')->nullable()->after('reviewed_by_name');
        });
    }

    public function down(): void
    {
        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->dropColumn(['reviewed_by_name', 'reviewed_by_position']);
        });
    }
};
