<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomerAccountsTable extends Migration
            
{
    public function up()
    {
        Schema::create('customer_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id');
            $table->uuid('company_id')->nullable();
            $table->string('account_number')->unique();
            $table->string('certificate_of_incorporation_number')->nullable();
            $table->decimal('annual_turnover', 15, 2)->nullable();
            $table->decimal('credit_required', 15, 2)->nullable();
            $table->decimal('pending_credit_limit', 15, 2)->nullable();
            $table->string('credit_period_required')->nullable();
            $table->boolean('currently_defaulted')->default(false);
            $table->string('credit_terms')->nullable();
            $table->decimal('current_balance', 15, 2)->default(0);
            $table->uuid('created_by')->nullable();
            $table->text('notes')->nullable();
            $table->enum('approval_status', ['draft', 'pending', 'in_progress', 'approved', 'rejected'])->default('draft');
            $table->uuid('workflow_instance_id')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
            $table->index(['approval_status']);
            $table->index('pending_credit_limit');
        });
    }

    public function down()
    {
        Schema::dropIfExists('customer_accounts');
    }
}
