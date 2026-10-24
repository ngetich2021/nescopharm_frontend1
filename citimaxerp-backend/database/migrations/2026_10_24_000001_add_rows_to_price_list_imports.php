<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Each import's row-by-row outcome (old -> new price, new product, error), shown when a
    // history row is expanded and used to rebuild the sheet if the uploaded file is gone.
    public function up(): void
    {
        Schema::table('price_list_imports', function (Blueprint $table) {
            $table->json('rows')->nullable()->after('errors_count');
        });
    }

    public function down(): void
    {
        Schema::table('price_list_imports', function (Blueprint $table) {
            $table->dropColumn('rows');
        });
    }
};
