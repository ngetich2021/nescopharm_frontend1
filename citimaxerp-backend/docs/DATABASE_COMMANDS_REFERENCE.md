# Quick Reference: Database Configuration Commands

## Verify Database Configuration

Run this command to verify your Supabase PgBouncer configuration:

```bash
php scripts/verify_pgbouncer_config.php
```

**Expected Output**:
```
=================================================
  ✓ ALL TESTS PASSED
  Your database is correctly configured for
  Supabase PgBouncer connection pooling.
=================================================
```

## After Deployment

Run these commands after deploying configuration changes:

```bash
# Clear configuration cache
php artisan config:clear

# Clear all caches
php artisan cache:clear

# Verify database configuration
php scripts/verify_pgbouncer_config.php

# Test database connectivity
php artisan tinker --execute="echo 'Connection test: ' . DB::table('users')->count() . ' users found\n';"
```

## Check PDO Settings Manually

```bash
php artisan tinker --execute="
echo 'PDO Settings:\n';
echo '- ATTR_EMULATE_PREPARES: ' . (DB::connection()->getPdo()->getAttribute(PDO::ATTR_EMULATE_PREPARES) ? 'ENABLED ✓' : 'DISABLED ✗') . '\n';
echo '- ATTR_PERSISTENT: ' . (DB::connection()->getPdo()->getAttribute(PDO::ATTR_PERSISTENT) ? 'ENABLED ✗' : 'DISABLED ✓') . '\n';
"
```

**Expected Output**:
```
PDO Settings:
- ATTR_EMULATE_PREPARES: ENABLED ✓
- ATTR_PERSISTENT: DISABLED ✓
```

## Monitor Logs for Errors

```bash
# Watch for prepared statement errors
tail -f storage/logs/laravel.log | grep -i "prepared"

# Watch for database errors
tail -f storage/logs/laravel.log | grep -i "database"

# Watch for connection errors
tail -f storage/logs/laravel.log | grep -i "connection"
```

## Troubleshooting Commands

### If you see prepared statement errors:

```bash
# 1. Clear all caches
php artisan config:clear && php artisan cache:clear

# 2. Verify configuration
php scripts/verify_pgbouncer_config.php

# 3. Check for PDO overrides in code
grep -r "ATTR_EMULATE_PREPARES" app/

# 4. Check service providers
grep -r "setAttribute.*PDO" app/Providers/
```

### Force reconnect to database:

```bash
php artisan tinker --execute="
DB::purge();
echo 'Database connections purged. Next query will create fresh connection.\n';
DB::table('users')->count();
echo 'Successfully connected!\n';
"
```

## Health Check Endpoint (Recommended)

Add this to your application for monitoring:

```php
// routes/api.php or routes/web.php
Route::get('/health/database', function () {
    try {
        $pdo = DB::connection()->getPdo();
        $emulatedPrepares = $pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES);
        $persistent = $pdo->getAttribute(PDO::ATTR_PERSISTENT);
        
        $health = [
            'status' => 'healthy',
            'emulated_prepares' => $emulatedPrepares,
            'persistent_connections' => $persistent,
            'connection_test' => DB::select('SELECT 1 as test')[0]->test === 1,
            'config_correct' => $emulatedPrepares && !$persistent,
        ];
        
        return response()->json($health, $health['config_correct'] ? 200 : 500);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'unhealthy',
            'error' => $e->getMessage()
        ], 500);
    }
});
```

Test it:
```bash
curl http://your-api-url/health/database
```

## Automated Monitoring

### Add to cron for periodic checks:

```bash
# Add to crontab
0 * * * * cd /path/to/cherry-api && php scripts/verify_pgbouncer_config.php >> /var/log/db-check.log 2>&1
```

### Laravel Scheduler (Recommended):

```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Check database config every hour
    $schedule->call(function () {
        try {
            $pdo = DB::connection()->getPdo();
            $emulatedPrepares = $pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES);
            
            if (!$emulatedPrepares) {
                Log::error('Database configuration error: Emulated prepares is disabled!');
                // Send alert to your monitoring system
            }
        } catch (\Exception $e) {
            Log::error('Database health check failed', ['error' => $e->getMessage()]);
        }
    })->hourly();
}
```

## CI/CD Integration

### Add to deployment script:

```bash
#!/bin/bash
# deploy.sh

echo "Deploying application..."

# Pull latest code
git pull origin main

# Install dependencies
composer install --no-dev --optimize-autoloader

# Run migrations
php artisan migrate --force

# Clear caches
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# VERIFY DATABASE CONFIGURATION
echo "Verifying database configuration..."
if php scripts/verify_pgbouncer_config.php; then
    echo "✓ Database configuration verified"
else
    echo "✗ Database configuration failed verification"
    exit 1
fi

echo "Deployment complete!"
```

### GitHub Actions Example:

```yaml
# .github/workflows/deploy.yml
- name: Verify Database Configuration
  run: |
    php scripts/verify_pgbouncer_config.php
    if [ $? -ne 0 ]; then
      echo "Database configuration verification failed"
      exit 1
    fi
```

## Quick Fix Script

Save this as `scripts/fix_db_config.sh`:

```bash
#!/bin/bash
# Quick fix for database configuration issues

echo "Fixing database configuration..."

# Clear caches
php artisan config:clear
php artisan cache:clear

# Verify configuration
php scripts/verify_pgbouncer_config.php

if [ $? -eq 0 ]; then
    echo "✓ Database configuration is correct"
    exit 0
else
    echo "✗ Database configuration has issues"
    echo "Please check:"
    echo "  1. config/database.php has PDO::ATTR_EMULATE_PREPARES => true"
    echo "  2. app/Providers/AppServiceProvider.php doesn't override PDO settings"
    echo "  3. No other code is calling setAttribute on PDO"
    exit 1
fi
```

Make it executable:
```bash
chmod +x scripts/fix_db_config.sh
```

Run it:
```bash
./scripts/fix_db_config.sh
```

---

## Summary

All configuration changes have been applied and verified. Use the commands above for:

- ✅ **Verification**: Run verification script after any changes
- ✅ **Monitoring**: Set up health checks and log monitoring
- ✅ **Deployment**: Integrate verification into CI/CD
- ✅ **Troubleshooting**: Quick commands to diagnose issues

**The prepared statement error should never occur again.**
