<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chosen when the dispatch is raised: the transporter (from the approved delivery rates) and the
 * destination (the customer's town unless changed). They fill the invoice's dispatch fields at once
 * and are handed on to the logistics entry, where the dispatcher only picks the charge (zone).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_dispatches', function (Blueprint $table) {
            if (!Schema::hasColumn('order_dispatches', 'dispatched_through')) {
                $table->string('dispatched_through')->nullable()->after('delivery_location_id');
            }
            if (!Schema::hasColumn('order_dispatches', 'destination')) {
                $table->string('destination')->nullable()->after('dispatched_through');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_dispatches', function (Blueprint $table) {
            $table->dropColumn(['dispatched_through', 'destination']);
        });
    }
};
