<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The approver (GM / Director / Warehouse Manager) can now reject or cancel an order awaiting
 * approval as well as approve it. Rejected orders are deleted after an hour; cancelled ones can
 * be restored for 24 hours, then they're deleted (orders:purge-declined).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('rejected_at')->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            // What to go back to when a cancelled order is restored.
            $table->string('status_before_cancel', 20)->nullable();
            $table->index('rejected_at');
            $table->index('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['rejected_at']);
            $table->dropIndex(['cancelled_at']);
            $table->dropColumn(['rejected_at', 'rejected_by', 'rejection_reason', 'cancelled_at', 'cancelled_by', 'cancellation_reason', 'status_before_cancel']);
        });
    }
};
