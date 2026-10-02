<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->string('delivery_note_file')->nullable();
            $table->timestamp('delivery_note_uploaded_at')->nullable();
            $table->uuid('delivery_note_uploaded_by')->nullable();

            $table->foreign('delivery_note_uploaded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->dropForeign(['delivery_note_uploaded_by']);
            $table->dropColumn(['delivery_note_file', 'delivery_note_uploaded_at', 'delivery_note_uploaded_by']);
        });
    }
};
