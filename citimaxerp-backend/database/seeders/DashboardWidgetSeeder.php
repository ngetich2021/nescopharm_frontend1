<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Services\DashboardWidgetService;
use App\Models\Company;
use Illuminate\Support\Facades\Log;

class DashboardWidgetSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $companies = Company::active()->get();
        
        $this->command->info("Starting dashboard widget seeding for " . $companies->count() . " companies...");

        $successCount = 0;
        $skippedCount = 0;
        $failedCount = 0;

        foreach ($companies as $company) {
            try {
                $result = DashboardWidgetService::createDefaultWidgetsForCompany($company->id);
                
                if ($result) {
                    $this->command->info("✅ Created default dashboard widgets for company: {$company->name}");
                    $successCount++;
                } else {
                    $this->command->info("⏭️  Skipped company '{$company->name}' - widgets already exist");
                    $skippedCount++;
                }
                
            } catch (\Exception $e) {
                $this->command->error("❌ Failed to process company '{$company->name}': " . $e->getMessage());
                Log::error("Company dashboard widget seeding failed", [
                    'company_id' => $company->id,
                    'company_name' => $company->name,
                    'error' => $e->getMessage()
                ]);
                $failedCount++;
            }
        }

        $this->command->info('🎉 Dashboard widget seeding completed!');
        $this->command->info("📊 Summary:");
        $this->command->info("   - Successfully processed: {$successCount} companies");
        $this->command->info("   - Skipped (already have widgets): {$skippedCount} companies");
        $this->command->info("   - Failed: {$failedCount} companies");
        
        $totalWidgetTypes = count(DashboardWidgetService::getAvailableWidgetTypes());
        $this->command->info("   - Available widget types: {$totalWidgetTypes}");
    }

    /**
     * Seed widgets for a specific company (useful for adding widgets to new companies)
     */
    public function seedForCompany(string $companyId): bool
    {
        return DashboardWidgetService::createDefaultWidgetsForCompany($companyId);
    }
}
