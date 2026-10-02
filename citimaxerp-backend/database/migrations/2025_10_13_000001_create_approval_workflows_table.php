<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateApprovalWorkflowsTable extends Migration
{
    public function up()
    {
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name'); // e.g., "Customer Account Approval", "Dispatch Approval"
            $table->string('module_type'); // e.g., "customer_account", "dispatch", "customer"
            $table->uuid('company_id')->nullable(); // null for system-wide workflows
            $table->text('description')->nullable();
            $table->json('conditions')->nullable(); // conditions for triggering this workflow
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0); // for ordering workflows when multiple match
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['module_type', 'company_id', 'is_active']);
            $table->index(['is_active', 'priority']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('approval_workflows');
    }
}