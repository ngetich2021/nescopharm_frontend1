<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('dispatches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('dispatch_number')->unique();
            $table->uuid('from_store_id');
            $table->string('to_entity');
            $table->uuid('to_user_id')->nullable();
            $table->enum('type', ['internal', 'external']);
            $table->boolean('is_returnable')->default(false);
            $table->date('return_date')->nullable();
            $table->boolean('is_returned')->default(false);
            $table->uuid('returned_by')->nullable();
            $table->enum('approval_status', ['draft', 'pending', 'in_progress', 'approved', 'rejected'])->default('draft');
            $table->uuid('workflow_instance_id')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('acknowledged_by')->nullable();
            $table->timestamps();

            $table->foreign('from_store_id')->references('id')->on('stores');
            $table->foreign('to_user_id')->references('id')->on('users');
            $table->foreign('acknowledged_by')->references('id')->on('users');
            $table->foreign('returned_by')->references('id')->on('users');
            $table->index(['approval_status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('dispatches');
    }
};
