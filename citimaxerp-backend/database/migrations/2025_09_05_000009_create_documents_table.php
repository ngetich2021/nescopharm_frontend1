<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocumentsTable extends Migration
           
{
    public function up()
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('document_name');
            $table->string('document_number')->unique(); // generated automatically
            $table->string('reference_number')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('regulatory_body')->nullable();
            $table->string('document_image')->nullable(); // Supabase image URL
            $table->string('documentable_type'); // polymorphic relation
            $table->uuid('documentable_id');
            $table->uuid('company_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->text('other_information')->nullable();
            $table->timestamps();

             $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
        });
    }
    public function down()
    {
        Schema::dropIfExists('documents');
    }
}
