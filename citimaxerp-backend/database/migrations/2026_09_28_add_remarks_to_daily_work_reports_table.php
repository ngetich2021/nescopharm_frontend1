<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_work_reports', function (Blueprint $table) {
            $table->text('remarks')->nullable()->after('pending_work');
        });
    }

    public function down(): void
    {
        Schema::table('daily_work_reports', function (Blueprint $table) {
            $table->dropColumn('remarks');
        });
    }
};
