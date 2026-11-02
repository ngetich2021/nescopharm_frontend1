<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// The Action a collector sets for a customer (or supplier) on the Receivables & Payables page,
// e.g. "Hand over to lawyer". None set means the page's own suggestion is shown.
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('collection_actions')) {
            return;
        }
        Schema::create('collection_actions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('party_type', 20)->comment('customer or supplier');
            $table->uuid('party_id');
            $table->string('action', 255);
            $table->uuid('updated_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'party_type', 'party_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_actions');
    }
};
