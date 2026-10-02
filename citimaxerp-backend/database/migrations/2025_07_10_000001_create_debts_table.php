<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('debts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->nullable()->index();
            $table->uuid('order_id')->nullable()->index();
            $table->uuid('company_id')->index();
            $table->decimal('amount', 15, 2);
            $table->string('status')->default('unpaid'); // unpaid, paid, partial, overdue
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('payment_id')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down()
    {
        Schema::dropIfExists('debts');
    }
};
