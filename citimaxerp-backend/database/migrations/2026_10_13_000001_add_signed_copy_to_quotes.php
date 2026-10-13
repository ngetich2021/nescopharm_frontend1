<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The customer's signed & stamped copy of a quote - proof they agreed to it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('signed_quote_path')->nullable();
            $table->string('signed_quote_name')->nullable();
            $table->timestamp('signed_quote_uploaded_at')->nullable();
            $table->uuid('signed_quote_uploaded_by')->nullable();

            $table->foreign('signed_quote_uploaded_by', 'quotes_signed_quote_uploaded_by_fkey')
                ->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign('quotes_signed_quote_uploaded_by_fkey');
            $table->dropColumn(['signed_quote_path', 'signed_quote_name', 'signed_quote_uploaded_at', 'signed_quote_uploaded_by']);
        });
    }
};
