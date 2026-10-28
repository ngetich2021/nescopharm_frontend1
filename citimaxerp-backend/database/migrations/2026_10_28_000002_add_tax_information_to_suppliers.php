<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The supplier form and import send a KRA PIN (tax_information), but there was no column to keep it.
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('suppliers', 'tax_information')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->string('tax_information')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('suppliers', 'tax_information')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->dropColumn('tax_information');
            });
        }
    }
};
