<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who last edited a delivery rate: an accountant may not approve a rate they raised or changed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('delivery_rates', 'last_edited_by')) {
            Schema::table('delivery_rates', fn (Blueprint $table) => $table->uuid('last_edited_by')->nullable());
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('delivery_rates', 'last_edited_by')) {
            Schema::table('delivery_rates', fn (Blueprint $table) => $table->dropColumn('last_edited_by'));
        }
    }
};
