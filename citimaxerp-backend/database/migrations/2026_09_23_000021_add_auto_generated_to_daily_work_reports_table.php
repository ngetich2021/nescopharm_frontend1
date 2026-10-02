<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Flags a report the nightly FlagMissingDailyReports command posted on
     * an employee's behalf (status 'missed') rather than one they filled
     * in themselves, so the UI can label it distinctly ("auto-posted by
     * the system") instead of it looking like a genuine submission.
     */
    public function up(): void
    {
        Schema::table('daily_work_reports', function (Blueprint $table) {
            $table->boolean('auto_generated')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('daily_work_reports', function (Blueprint $table) {
            $table->dropColumn('auto_generated');
        });
    }
};
