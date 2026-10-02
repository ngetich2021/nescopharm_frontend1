<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('product_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->uuid('supplier_id')->nullable();
            $table->uuid('contractor_id')->nullable();
            $table->enum('document_type', ['receipt', 'invoice', 'delivery_note', 'notification_note']);
            $table->string('product_receipt_number')->unique();
            $table->string('reference_number')->nullable();
            $table->uuid('received_by');
            $table->uuid('store_id');
            $table->string('document_url')->nullable();
            $table->timestamps();
            $table->foreign('store_id')->references('id')->on('stores');
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_receipts');
    }
};
