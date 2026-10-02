<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('primary_country_code', 2)->default('KE')->after('country');
            $table->index('primary_country_code');
        });

        DB::table('companies')
            ->whereNull('primary_country_code')
            ->update(['primary_country_code' => 'KE']);
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropIndex(['primary_country_code']);
            $table->dropColumn('primary_country_code');
        });
    }
};
