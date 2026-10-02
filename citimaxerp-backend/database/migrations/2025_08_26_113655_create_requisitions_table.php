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
        Schema::create('requisitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('requisition_number')->unique();
            $table->uuid('company_id');
            $table->uuid('requester_id');
            $table->enum('approval_status', ['pending', 'in_review', 'approved', 'rejected'])->default('pending');
            $table->enum('status', ['pending', 'approved', 'dispatched', 'acknowledged', 'rejected'])->default('pending');
            $table->uuid('approver_id')->nullable();
            $table->uuid('dispatch_id')->nullable()->after('approver_id');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies');
            $table->foreign('requester_id')->references('id')->on('users');
            $table->foreign('approver_id')->references('id')->on('users');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('requisitions');
    }
};
