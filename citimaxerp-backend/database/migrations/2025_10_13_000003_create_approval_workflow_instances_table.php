<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateApprovalWorkflowInstancesTable extends Migration
{
    public function up()
    {
        Schema::create('approval_workflow_instances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->string('entity_type'); // e.g., "customer_account", "customer", "dispatch"
            $table->uuid('entity_id'); // ID of the record being approved
            $table->uuid('current_step_id')->nullable(); // current step being processed
            $table->enum('status', ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->uuid('initiated_by');
            $table->uuid('company_id');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('metadata')->nullable(); // additional data for the workflow
            $table->timestamps();

            $table->foreign('workflow_id')->references('id')->on('approval_workflows')->onDelete('cascade');
            $table->foreign('current_step_id')->references('id')->on('approval_workflow_steps')->onDelete('set null');
            $table->foreign('initiated_by')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            
            $table->index(['entity_type', 'entity_id']);
            $table->index(['status', 'company_id']);
            $table->index(['initiated_by']);
            $table->index(['current_step_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('approval_workflow_instances');
    }
}