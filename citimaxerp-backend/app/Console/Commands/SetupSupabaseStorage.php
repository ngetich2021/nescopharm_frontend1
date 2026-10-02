<?php

namespace App\Console\Commands;

use App\Services\SupabaseStorageService;
use Illuminate\Console\Command;

class SetupSupabaseStorage extends Command
{
    protected $signature = 'supabase:setup-storage';
    protected $description = 'Set up Supabase storage bucket for chat media';

    public function handle()
    {
        $this->info('Setting up Supabase storage...');

        try {
            $supabaseService = new SupabaseStorageService();
            
            // Test connection
            $this->info('Testing Supabase connection...');
            $connectionTest = $supabaseService->testConnection();
            
            if ($connectionTest['success']) {
                $this->info('✓ Connection successful');
            } else {
                $this->error('✗ Connection failed: ' . $connectionTest['error']);
                return 1;
            }

            // Create bucket
            $this->info('Creating storage bucket...');
            $bucketResult = $supabaseService->createBucket();
            
            if ($bucketResult['success']) {
                $this->info('✓ ' . $bucketResult['message']);
            } else {
                $this->error('✗ Bucket creation failed: ' . $bucketResult['error']);
                return 1;
            }

            // Make bucket public
            $this->info('Making bucket public...');
            $publicResult = $supabaseService->makeBucketPublic();
            
            if ($publicResult['success']) {
                $this->info('✓ ' . $publicResult['message']);
            } else {
                $this->error('✗ Making bucket public failed: ' . $publicResult['error']);
                return 1;
            }

            $this->info('✓ Supabase storage setup completed successfully!');
            
            return 0;

        } catch (\Exception $e) {
            $this->error('Setup failed: ' . $e->getMessage());
            return 1;
        }
    }
}
