<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A credit note is only credited once both people its creator chose approve it, each with a
 * comment ("products in good shape"). credit_notes.approval_status: pending | approved | rejected
 * (null for credit notes from before approvals were required).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('credit_note_approvals')) {
            Schema::create('credit_note_approvals', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('credit_note_id')->index();
                $table->uuid('approver_id')->index();
                $table->unsignedTinyInteger('position')->default(1);
                $table->string('status', 20)->default('pending'); // pending | approved | rejected
                $table->text('comment')->nullable();
                $table->timestamp('decided_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasColumn('credit_notes', 'approval_status')) {
            Schema::table('credit_notes', function (Blueprint $table) {
                $table->string('approval_status', 20)->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_note_approvals');
        if (Schema::hasColumn('credit_notes', 'approval_status')) {
            Schema::table('credit_notes', fn (Blueprint $table) => $table->dropColumn('approval_status'));
        }
    }
};
