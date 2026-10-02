<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->uuid('leave_approver_id')->nullable()->after('supervisor_id');
            $table->uuid('salary_advance_approver_id')->nullable()->after('leave_approver_id');

            $table->foreign('leave_approver_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('salary_advance_approver_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropForeign(['leave_approver_id']);
            $table->dropForeign(['salary_advance_approver_id']);
            $table->dropColumn(['leave_approver_id', 'salary_advance_approver_id']);
        });
    }
};
