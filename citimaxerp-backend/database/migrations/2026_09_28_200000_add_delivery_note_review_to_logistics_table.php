<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            // pending_review | approved | resubmit_requested (null = nothing uploaded yet)
            $table->string('delivery_note_status')->nullable()->after('delivery_note_uploaded_by');
            $table->uuid('delivery_note_reviewed_by')->nullable()->after('delivery_note_status');
            $table->timestamp('delivery_note_reviewed_at')->nullable()->after('delivery_note_reviewed_by');
            $table->text('delivery_note_review_comment')->nullable()->after('delivery_note_reviewed_at');

            $table->foreign('delivery_note_reviewed_by')->references('id')->on('users')->nullOnDelete();
        });

        DB::table('logistics')
            ->whereNotNull('delivery_note_file')
            ->update(['delivery_note_status' => 'pending_review']);
    }

    public function down(): void
    {
        Schema::table('logistics', function (Blueprint $table) {
            $table->dropForeign(['delivery_note_reviewed_by']);
            $table->dropColumn([
                'delivery_note_status',
                'delivery_note_reviewed_by',
                'delivery_note_reviewed_at',
                'delivery_note_review_comment',
            ]);
        });
    }
};
