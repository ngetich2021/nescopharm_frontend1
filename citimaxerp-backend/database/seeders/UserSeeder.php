<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        $users = [
            [
                'first_name' => 'John',
                'last_name' => 'Doe',
                'email' => '',
                'password' => 'password',
                'phone_number' => '0712345678',
                'role' => 'admin',
                'status' => 'active',
            ],
            [
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'email' => '',
                'password' => 'password',
                'phone_number' => '0712345679',
                'role' => 'admin',
                'status' => 'active',
            ],
        ];
    }
}
