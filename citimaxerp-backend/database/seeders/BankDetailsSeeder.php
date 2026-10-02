<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class BankDetailsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $bankDetails = [
            [
                'bank_name' => 'Bank of America',
                'bank_code' => 'BOA',
                'bank_branch' => 'Main Branch',
                'account_name' => 'John Doe',
                'account_number' => '1234567890',
                'swift_code' => 'BOFAUS3N',
                'iban' => 'US1234567890',
                'routing_number' => '123456789',
                'sort_code' => '123456',
                'country_id' => 1,
                'customer_id' => 1,
            ],
            [
                'bank_name' => 'Wells Fargo',
                'bank_code' => 'WF',
                'bank_branch' => 'Main Branch',
                'account_name' => 'Jane Doe',
                'account_number' => '0987654321',
                'swift_code' => 'WFUS3N',
                'iban' => 'US0987654321',
                'routing_number' => '098765432',
                'sort_code' => '098765',
                'country_id' => 2,
                'customer_id' => 2,
            ],
        ];

        foreach ($bankDetails as $bankDetail) {
            \App\Models\BankDetails::create($bankDetail);
        }
    }
}
