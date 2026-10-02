<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sops', function (Blueprint $table) {
            $table->string('storage_disk')->nullable()->after('document_path');
        });

        // Existing imported files are currently on the local public disk.
        DB::table('sops')
            ->whereNull('storage_disk')
            ->update(['storage_disk' => 'public']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sops', function (Blueprint $table) {
            $table->dropColumn('storage_disk');
        });
    }
};
