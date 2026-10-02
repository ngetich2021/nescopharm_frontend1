<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateApprovalWorkflowStepInstancesTable extends Migration
{
    public function up()
    {
        Schema::create('approval_workflow_step_instances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_instance_id');
            $table->uuid('step_id');
            $table->uuid('assigned_to'); // user who needs to approve this step
            $table->enum('status', ['pending', 'approved', 'rejected', 'skipped', 'escalated'])->default('pending');
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->text('comments')->nullable();
            $table->json('decision_metadata')->nullable(); // additional data about the decision
            $table->uuid('escalated_to')->nullable(); // if escalated, who it was escalated to
            $table->timestamp('escalated_at')->nullable();
            $table->timestamps();

            $table->foreign('workflow_instance_id')->references('id')->on('approval_workflow_instances')->onDelete('cascade');
            $table->foreign('step_id')->references('id')->on('approval_workflow_steps')->onDelete('cascade');
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('escalated_to')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['workflow_instance_id', 'step_id']);
            $table->index(['assigned_to', 'status']);
            $table->index(['status', 'assigned_at']);
            $table->unique(['workflow_instance_id', 'step_id']); // one instance per step per workflow
        });
    }

    public function down()
    {
        Schema::dropIfExists('approval_workflow_step_instances');
    }
}