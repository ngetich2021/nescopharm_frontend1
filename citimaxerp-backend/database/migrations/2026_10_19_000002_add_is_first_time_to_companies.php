<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Company creation and the onboarding cards write companies.is_first_time, but the
 * column was never created. Existing companies are already set up, so they default to false.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('companies', 'is_first_time')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('is_first_time')->default(false);
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('companies', 'is_first_time')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->dropColumn('is_first_time');
            });
        }
    }
};
