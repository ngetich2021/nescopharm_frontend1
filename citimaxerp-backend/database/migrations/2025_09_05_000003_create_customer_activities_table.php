<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomerActivitiesTable extends Migration
{
    public function up()
    {
        Schema::create('customer_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id');
            $table->enum('activity_type', ['call', 'email', 'meeting', 'other'])->default('call');
            $table->dateTime('activity_date');
            $table->string('outcome')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('customer_activities');
    }
}
