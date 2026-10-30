<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    // The rest of the paper Employee Leave Request Form: when it was filled in, the day the
    // employee reports back, how much leave (hours / a day / days), the reason box ticked,
    // and the balance left on that leave type. is_record marks leave captured after it was
    // taken (start date today or earlier): it goes straight in as approved by the GM.
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->date('request_date')->nullable();
            $table->date('reporting_date')->nullable();
            $table->string('duration_unit', 10)->nullable();
            $table->decimal('total_requested', 8, 2)->nullable();
            $table->string('reason_category', 20)->nullable();
            $table->decimal('balance_days', 8, 2)->nullable();
            $table->boolean('is_record')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropColumn(['request_date', 'reporting_date', 'duration_unit', 'total_requested', 'reason_category', 'balance_days', 'is_record']);
        });
    }
};
