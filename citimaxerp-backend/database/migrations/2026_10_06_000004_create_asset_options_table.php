<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('asset_options', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('type'); // 'category' | 'department'
            $table->string('name');
            $table->timestamps();

            $table->unique(['company_id', 'type', 'name']);
            $table->index(['company_id', 'type']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('asset_options');
    }
};
