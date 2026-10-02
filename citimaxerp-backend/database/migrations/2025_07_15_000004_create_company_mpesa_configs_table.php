<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('company_mpesa_configs', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('paybill_number')->nullable();
            $table->string('till_number')->nullable();
            $table->string('shortcode')->nullable();
            $table->string('consumer_key')->nullable();
            $table->string('consumer_secret')->nullable();
            $table->string('passkey')->nullable();
            $table->string('callback_url')->nullable();
            $table->string('confirmation_url')->nullable();
            $table->string('validation_url')->nullable();
            $table->string('environment')->default('sandbox');
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('company_mpesa_configs');
    }
};
