<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('price_list_imports', function (Blueprint $table) {
            $table->string('file_path')->nullable()->after('file_name');
        });
    }

    public function down(): void
    {
        Schema::table('price_list_imports', function (Blueprint $table) {
            $table->dropColumn('file_path');
        });
    }
};
