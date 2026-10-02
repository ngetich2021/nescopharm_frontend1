<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Invoice>
 */
class InvoiceFactory extends Factory
{
    /**
     * Define the model's default state.
     */
    public function definition(): array
    {
        return [
            'invoice_number' => 'INV-' . $this->faker->unique()->numerify('######'),
            'invoice_date' => now(),
            'due_date' => now()->addDays(30),
            'subtotal_amount' => 1000,
            'tax_amount' => 100,
            'total_amount' => 1100,
            'paid_amount' => 0,
            'remaining_amount' => 1100,
            'status' => 'draft',
            'description' => $this->faker->text(),
        ];
    }
}
