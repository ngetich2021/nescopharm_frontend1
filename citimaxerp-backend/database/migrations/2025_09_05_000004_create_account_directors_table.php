<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateAccountDirectorsTable extends Migration
{
    public function up()
    {
        Schema::create('account_directors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_account_id');
            $table->uuid('company_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->string('name');
            $table->string('id_passport_number');
            $table->string('pin');
            $table->string('phone_number');
            $table->timestamps();
            $table->foreign('customer_account_id')->references('id')->on('customer_accounts')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
        });
    }
    public function down()
    {
        Schema::dropIfExists('account_directors');
    }
}
