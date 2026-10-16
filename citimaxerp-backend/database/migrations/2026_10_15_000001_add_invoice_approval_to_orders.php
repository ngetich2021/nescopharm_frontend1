<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An order can only be invoiced once the GM or a Director has approved it,
 * recording who approved, why, and who the customer's contact person is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->uuid('invoice_approved_by')->nullable();
            $table->timestamp('invoice_approved_at')->nullable();
            $table->text('invoice_approval_comment')->nullable();
            $table->string('invoice_contact_person')->nullable();
            $table->string('invoice_contact_phone')->nullable();

            $table->foreign('invoice_approved_by', 'orders_invoice_approved_by_fkey')
                ->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign('orders_invoice_approved_by_fkey');
            $table->dropColumn(['invoice_approved_by', 'invoice_approved_at', 'invoice_approval_comment', 'invoice_contact_person', 'invoice_contact_phone']);
        });
    }
};
