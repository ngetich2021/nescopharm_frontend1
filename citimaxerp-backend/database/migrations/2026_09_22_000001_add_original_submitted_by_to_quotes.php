<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * submitted_by_id (see 2026_09_20_130200) gets cleared the moment staff first
 * edit a rep-submitted quote, so it can no longer be used to route the quote
 * back to its originating rep for final confirmation. original_submitted_by_id
 * is stamped once at creation and never cleared, so the rep-confirmation flow
 * (QuoteController::confirm/requestChanges) can always find its owner.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->uuid('original_submitted_by_id')->nullable()->after('submitted_at');

            $table->foreign('original_submitted_by_id', 'quotes_original_submitted_by_id_fkey')
                ->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign('quotes_original_submitted_by_id_fkey');
            $table->dropColumn('original_submitted_by_id');
        });
    }
};
