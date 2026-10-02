<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('breakage_item_dispatch', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('breakage_item_id');
            $table->uuid('dispatch_id');
            $table->integer('quantity'); // Quantity replaced in this dispatch
            $table->timestamp('replaced_at')->nullable();
            $table->uuid('replaced_by')->nullable();
            $table->timestamps();

            $table->foreign('breakage_item_id')->references('id')->on('breakage_items')->onDelete('cascade');
            $table->foreign('dispatch_id')->references('id')->on('dispatches')->onDelete('cascade');
            $table->foreign('replaced_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('breakage_item_dispatch');
    }
};
