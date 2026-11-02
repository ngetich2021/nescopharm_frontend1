<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Collection notes on the Receivables & Payables page: each call with a customer (or supplier) -
// what was said, the date they promised to pay, and later whether that promise was kept.
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('collection_notes')) {
            return;
        }
        Schema::create('collection_notes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('party_type', 20)->comment('customer or supplier');
            $table->uuid('party_id');
            $table->uuid('invoice_id')->nullable();
            $table->text('note');
            $table->date('promise_date')->nullable();
            $table->decimal('promise_amount', 14, 2)->nullable();
            $table->string('outcome', 20)->nullable()->comment('kept or broken, once the promise date is checked');
            $table->uuid('created_by')->nullable();
            $table->uuid('outcome_by')->nullable();
            $table->timestamp('outcome_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('set null');
            $table->index(['company_id', 'party_type', 'party_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_notes');
    }
};
