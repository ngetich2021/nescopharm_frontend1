<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomerAccountApprovalsTable extends Migration
{
    public function up()
    {
        Schema::create('customer_account_approvals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_account_id');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('approval_type')->default('account_creation');
            $table->decimal('previous_credit_limit', 15, 2)->nullable();
            $table->decimal('new_credit_limit', 15, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('company_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('customer_account_id')->references('id')->on('customer_accounts')->onDelete('cascade');
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
            $table->index('approval_type');
        });
    }
    public function down()
    {
        Schema::dropIfExists('customer_account_approvals');
    }
}
