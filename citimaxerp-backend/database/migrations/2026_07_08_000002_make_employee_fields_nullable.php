<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE employees ALTER COLUMN employee_number DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN first_name DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN last_name DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN email DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN hire_date DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN employment_type DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN payment_frequency DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN basic_salary DROP NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN basic_salary DROP DEFAULT');
    }

    public function down(): void
    {
        DB::statement("UPDATE employees SET employee_number = CONCAT('EMP-', LPAD(COALESCE(NULLIF(employee_number, ''), id::text), 4, '0')) WHERE employee_number IS NULL");
        DB::statement("UPDATE employees SET first_name = '' WHERE first_name IS NULL");
        DB::statement("UPDATE employees SET last_name = '' WHERE last_name IS NULL");
        DB::statement("UPDATE employees SET email = CONCAT(id::text, '@placeholder.local') WHERE email IS NULL");
        DB::statement("UPDATE employees SET hire_date = CURRENT_DATE WHERE hire_date IS NULL");
        DB::statement("UPDATE employees SET employment_type = 'full_time' WHERE employment_type IS NULL");
        DB::statement("UPDATE employees SET payment_frequency = 'monthly' WHERE payment_frequency IS NULL");
        DB::statement("UPDATE employees SET basic_salary = 0 WHERE basic_salary IS NULL");

        DB::statement('ALTER TABLE employees ALTER COLUMN employee_number SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN first_name SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN last_name SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN email SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN hire_date SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN employment_type SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN payment_frequency SET NOT NULL');
        DB::statement('ALTER TABLE employees ALTER COLUMN basic_salary SET DEFAULT 0');
        DB::statement('ALTER TABLE employees ALTER COLUMN basic_salary SET NOT NULL');
    }
};
