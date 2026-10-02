<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Digitizes the paper "Employee Daily Work Report" (time-block table +
     * key achievements / pending work / signatures) used for off-staff
     * (Asli, Mary, Giden, Fidelis, ...). Sundays are intentionally excluded
     * at the application layer (see DailyWorkReport validation) rather than
     * here, matching the template's "Sunday: Off" working-hours note.
     *
     * Approval is role-based, not a fixed per-employee FK like
     * leave_approver_id/salary_advance_approver_id: a worker's report is
     * routed to GM, but a GM's own report is routed to the Managing
     * Director (role "Director"). approver_role snapshots which role was
     * required at submission time; approver_id snapshots the specific user
     * that resolved to at that time, for display only - the actual approve
     * check in DailyWorkReportController re-checks the live role/permission
     * so a later approver-role change doesn't strand old reports.
     */
    public function up(): void
    {
        Schema::create('daily_work_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('employee_id');
            $table->date('report_date');
            $table->string('designation')->nullable();
            $table->string('department')->nullable();
            // Array of { time, activity, remarks } rows mirroring the
            // template's Time / Work Activity Completed / Remarks table.
            $table->json('entries')->nullable();
            $table->text('key_achievements')->nullable();
            $table->text('pending_work')->nullable();
            $table->string('status')->default('pending'); // pending | approved | rejected
            $table->string('approver_role')->nullable(); // 'GM' or 'Director' at submission time
            $table->uuid('approver_id')->nullable(); // suggested approver at submission time
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->foreign('approver_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            // One report per employee per day.
            $table->unique(['employee_id', 'report_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_work_reports');
    }
};
