<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SubscriptionPlan;
use Illuminate\Support\Str;

class SubscriptionPlansSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $plans = [
            [
                'id' => Str::uuid(),
                'name' => 'Starter',
                'slug' => 'starter',
                'description' => 'Perfect for small businesses just getting started',
                'price' => 2500.00,
                'currency' => 'KES',
                'billing_cycle' => 'monthly',
                'max_users' => 5,
                'max_companies' => 1,
                'is_active' => true,
                'is_popular' => false,
                'trial_days' => 14,
                'features' => [
                    'Up to 5 users',
                    'Basic inventory management',
                    'Order processing',
                    'Customer management',
                    'Basic reporting',
                    'Email support',
                ],
                'limitations' => [
                    'Limited API calls per month',
                    'Basic integrations only',
                    'No advanced analytics',
                ]
            ],
            [
                'id' => Str::uuid(),
                'name' => 'Professional',
                'slug' => 'professional',
                'description' => 'Ideal for growing businesses that need more features',
                'price' => 5000.00,
                'currency' => 'KES',
                'billing_cycle' => 'monthly',
                'max_users' => 20,
                'max_companies' => 1,
                'is_active' => true,
                'is_popular' => true,
                'trial_days' => 14,
                'features' => [
                    'Up to 20 users',
                    'Advanced inventory management',
                    'Multi-store management',
                    'Advanced reporting & analytics',
                    'Financial management',
                    'Purchase order management',
                    'WhatsApp integration',
                    'Priority support',
                ],
                'limitations' => [
                    'Standard API limits',
                ]
            ],
            [
                'id' => Str::uuid(),
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'description' => 'Full-featured solution for large organizations',
                'price' => 12000.00,
                'currency' => 'KES',
                'billing_cycle' => 'monthly',
                'max_users' => null, // Unlimited
                'max_companies' => 1,
                'is_active' => true,
                'is_popular' => false,
                'trial_days' => 30,
                'features' => [
                    'Unlimited users',
                    'All system features',
                    'Advanced customization',
                    'Custom integrations',
                    'Dedicated account manager',
                    '24/7 phone support',
                    'Custom reporting',
                    'Data export/import tools',
                    'API access',
                    'Multi-company management',
                ],
                'limitations' => []
            ],
            [
                'id' => Str::uuid(),
                'name' => 'Basic Annual',
                'slug' => 'basic-annual',
                'description' => 'Annual billing for small businesses (2 months free)',
                'price' => 25000.00,
                'currency' => 'KES',
                'billing_cycle' => 'annual',
                'max_users' => 5,
                'max_companies' => 1,
                'is_active' => true,
                'is_popular' => false,
                'trial_days' => 14,
                'features' => [
                    'Up to 5 users',
                    'Basic inventory management',
                    'Order processing',
                    'Customer management',
                    'Basic reporting',
                    'Email support',
                    'Save 17% with annual billing',
                ],
                'limitations' => [
                    'Limited API calls per month',
                    'Basic integrations only',
                ]
            ],
            [
                'id' => Str::uuid(),
                'name' => 'Professional Annual',
                'slug' => 'professional-annual',
                'description' => 'Annual billing for growing businesses (2 months free)',
                'price' => 50000.00,
                'currency' => 'KES',
                'billing_cycle' => 'annual',
                'max_users' => 20,
                'max_companies' => 1,
                'is_active' => true,
                'is_popular' => true,
                'trial_days' => 14,
                'features' => [
                    'Up to 20 users',
                    'Advanced inventory management',
                    'Multi-store management',
                    'Advanced reporting & analytics',
                    'Financial management',
                    'Purchase order management',
                    'WhatsApp integration',
                    'Priority support',
                    'Save 17% with annual billing',
                ],
                'limitations' => []
            ]
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(
                ['slug' => $plan['slug']],
                $plan
            );
        }

        $this->command->info('Subscription plans seeded successfully!');
    }
}
