<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            // Kenya region grouping for the county (state) dropdown - `state`
            // already stores the county and `country` is fixed to Kenya.
            $table->string('region')->nullable()->after('state');
        });
    }

    public function down(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->dropColumn('region');
        });
    }
};
