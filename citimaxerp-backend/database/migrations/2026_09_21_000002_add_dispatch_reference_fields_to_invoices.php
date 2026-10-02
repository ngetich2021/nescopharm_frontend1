<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The Tally-style invoice format the company actually uses (delivery
     * note, buyer's order no., dispatch details, other references etc.)
     * has no equivalent columns here yet - these are manually entered at
     * invoice time since not every invoice originates from a sales order.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('delivery_note_number')->nullable()->after('terms_and_conditions');
            $table->date('delivery_note_date')->nullable()->after('delivery_note_number');
            $table->string('reference_number')->nullable()->after('delivery_note_date');
            $table->date('reference_date')->nullable()->after('reference_number');
            $table->string('other_references')->nullable()->after('reference_date');
            $table->string('buyers_order_no')->nullable()->after('other_references');
            $table->date('buyers_order_date')->nullable()->after('buyers_order_no');
            $table->string('dispatch_doc_no')->nullable()->after('buyers_order_date');
            $table->string('dispatched_through')->nullable()->after('dispatch_doc_no');
            $table->string('destination')->nullable()->after('dispatched_through');
            $table->string('terms_of_delivery')->nullable()->after('destination');
            $table->string('mode_of_payment')->nullable()->after('terms_of_delivery');
        });

        Schema::table('invoice_line_items', function (Blueprint $table) {
            $table->string('batch_number')->nullable()->after('unit');
            $table->date('expiry_date')->nullable()->after('batch_number');
        });
    }

    public function down(): void
    {
        Schema::table('invoice_line_items', function (Blueprint $table) {
            $table->dropColumn(['batch_number', 'expiry_date']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_note_number',
                'delivery_note_date',
                'reference_number',
                'reference_date',
                'other_references',
                'buyers_order_no',
                'buyers_order_date',
                'dispatch_doc_no',
                'dispatched_through',
                'destination',
                'terms_of_delivery',
                'mode_of_payment',
            ]);
        });
    }
};
