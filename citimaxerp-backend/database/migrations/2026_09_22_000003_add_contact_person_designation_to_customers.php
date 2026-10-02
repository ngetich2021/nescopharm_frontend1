<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Credit Appraisal Form's Primary Contact block (Procurement
 * Officer/Pharmacist-in-Charge) asks for a Designation, same as the
 * Accounts Contact block below it - but only Accounts Contact had a
 * designation column. Add the matching one for Primary Contact.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('contact_person_designation')->nullable()->after('contact_person_email');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('contact_person_designation');
        });
    }
};
