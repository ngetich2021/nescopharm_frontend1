<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('mpesa_transactions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('customer_id')->nullable();
            $table->string('payment_id')->nullable();
            // Outgoing STK push request fields
            $table->string('amount');
            $table->string('phone_number');
            $table->string('account_reference')->nullable();
            $table->string('transaction_desc')->nullable();
            $table->string('shortcode')->nullable(); // Paybill or till number used for outgoing
            $table->string('callback_url')->nullable();
            $table->string('transaction_type'); // outgoing, incoming
            $table->string('status')->default('pending'); // pending, completed, failed
            $table->text('description')->nullable();
            // STK push response/callback fields
            $table->string('checkout_request_id')->nullable();
            $table->string('merchant_request_id')->nullable();
            $table->string('result_code')->nullable();
            $table->string('result_desc')->nullable();
            $table->string('mpesa_receipt_number')->nullable();
            $table->string('mpesa_code')->nullable(); // alias for receipt number, for C2B
            $table->timestamp('transaction_date')->nullable();
            $table->string('balance')->nullable();
            // C2B (Paybill/Till) callback fields
            $table->string('paybill_number')->nullable();
            $table->string('till_number')->nullable();
            $table->string('sender_first_name')->nullable();
            $table->string('sender_middle_name')->nullable();
            $table->string('sender_last_name')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('org_account_balance')->nullable();
            $table->string('third_party_trans_id')->nullable();
            $table->text('raw_response')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('mpesa_transactions');
    }
};
