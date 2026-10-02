<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateAccountSuppliersTable extends Migration
{
    public function up()
    {
        Schema::create('account_suppliers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_account_id');
            $table->string('name');
            $table->string('contact_person_name');
            $table->string('phone_number');
            $table->uuid('company_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->decimal('credit_limit', 15, 2)->nullable();
            $table->timestamps();
            $table->foreign('customer_account_id')->references('id')->on('customer_accounts')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
        });
    }
    public function down()
    {
        Schema::dropIfExists('account_suppliers');
    }
}
