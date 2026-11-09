<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daily report drafts kept on the server (they used to live only in the browser), so the
 * midnight close can forward whatever an employee had written even if their page is shut.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('daily_work_report_drafts')) {
            return;
        }

        Schema::create('daily_work_report_drafts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('employee_id');
            $table->uuid('user_id');
            $table->date('report_date');
            $table->json('entries')->nullable();
            $table->text('key_achievements')->nullable();
            $table->text('pending_work')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'report_date']);
            $table->index(['company_id', 'report_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_work_report_drafts');
    }
};
