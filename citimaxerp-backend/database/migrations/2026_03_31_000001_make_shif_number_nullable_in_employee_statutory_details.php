<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::statement('ALTER TABLE employee_statutory_details ALTER COLUMN shif_number DROP NOT NULL');
        DB::statement('ALTER TABLE employee_statutory_details ALTER COLUMN nssf_number DROP NOT NULL');
    }

    public function down()
    {
        DB::statement('ALTER TABLE employee_statutory_details ALTER COLUMN shif_number SET NOT NULL');
        DB::statement('ALTER TABLE employee_statutory_details ALTER COLUMN nssf_number SET NOT NULL');
    }
};
