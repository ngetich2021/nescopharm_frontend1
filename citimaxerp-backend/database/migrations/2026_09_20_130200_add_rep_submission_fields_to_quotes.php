<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A Sales Rep checking out in POS creates a Quote (not a live Order) flagged
 * with these two fields, so it can be shown as "From: {rep} - {time}" and
 * routed to anyone with can_create_quotes for review/edit. The first edit by
 * an authorized user clears submitted_by_id, turning it into an ordinary quote.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->uuid('submitted_by_id')->nullable()->after('customer_id');
            $table->timestamp('submitted_at')->nullable()->after('submitted_by_id');

            $table->foreign('submitted_by_id', 'quotes_submitted_by_id_fkey')
                ->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign('quotes_submitted_by_id_fkey');
            $table->dropColumn(['submitted_by_id', 'submitted_at']);
        });
    }
};
