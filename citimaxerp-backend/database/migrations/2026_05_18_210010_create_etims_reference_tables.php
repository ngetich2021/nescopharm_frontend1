<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Five typed reference tables (per plan D4 decision): one per code class,
        // not one consolidated table - keeps each domain queryable independently
        // and matches DigiTax's own grouping.

        Schema::create('etims_item_class_codes', function (Blueprint $table) {
            $table->string('code', 16)->primary();
            $table->string('name', 255);
            $table->string('parent_code', 16)->nullable();
            $table->unsignedSmallInteger('level')->default(1);
            $table->boolean('is_leaf')->default(true);
            $table->timestamps();
            $table->index('parent_code');
            $table->index('level');
        });

        Schema::create('etims_packaging_units', function (Blueprint $table) {
            $table->string('code', 16)->primary();
            $table->string('name', 100);
            $table->timestamps();
        });

        Schema::create('etims_quantity_units', function (Blueprint $table) {
            $table->string('code', 16)->primary();
            $table->string('name', 100);
            $table->timestamps();
        });

        Schema::create('etims_tax_types', function (Blueprint $table) {
            $table->string('code', 1)->primary();
            $table->string('name', 64);
            $table->decimal('rate', 5, 4)->nullable(); // e.g. 0.1600 - null for "exempt" / "non-VAT"
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('etims_payment_types', function (Blueprint $table) {
            $table->string('code', 8)->primary();
            $table->string('name', 48);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etims_payment_types');
        Schema::dropIfExists('etims_tax_types');
        Schema::dropIfExists('etims_quantity_units');
        Schema::dropIfExists('etims_packaging_units');
        Schema::dropIfExists('etims_item_class_codes');
    }
};
