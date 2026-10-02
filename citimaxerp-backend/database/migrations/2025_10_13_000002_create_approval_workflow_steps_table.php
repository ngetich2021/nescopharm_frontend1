<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateApprovalWorkflowStepsTable extends Migration
{
    public function up()
    {
        Schema::create('approval_workflow_steps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->integer('step_order'); // 1, 2, 3, etc. for sequential steps
            $table->string('step_name'); // e.g., "Sales Manager Review", "Finance Approval"
            $table->text('description')->nullable();
            $table->enum('approver_type', ['role', 'user', 'hierarchy']); // how to determine approver
            $table->string('approver_reference'); // role_id, user_id, or hierarchy level
            $table->json('conditions')->nullable(); // conditions for this step (e.g., amount thresholds)
            $table->boolean('is_required')->default(true); // false for optional steps
            $table->boolean('allow_rejection')->default(true);
            $table->integer('timeout_hours')->nullable(); // escalation timeout
            $table->uuid('escalation_approver_reference')->nullable(); // backup approver
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('workflow_id')->references('id')->on('approval_workflows')->onDelete('cascade');
            
            $table->index(['workflow_id', 'step_order']);
            $table->index(['is_active']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('approval_workflow_steps');
    }
}