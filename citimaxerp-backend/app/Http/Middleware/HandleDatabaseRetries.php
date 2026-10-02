<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PDOException;
use Symfony\Component\HttpFoundation\Response;

class HandleDatabaseRetries
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $maxRetries = 3;
        $attempt = 0;

        while ($attempt <= $maxRetries) {
            try {
                return $next($request);
            } catch (PDOException $e) {
                $attempt++;
                
                // Check if this is a connection-related error (including prepared statement errors)
                if ($this->isConnectionError($e) && $attempt <= $maxRetries) {
                    Log::warning("Database connection error in middleware, attempt {$attempt}/{$maxRetries}", [
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'url' => $request->url(),
                        'method' => $request->method()
                    ]);
                    
                    // For prepared statement errors, purge ALL database connections
                    // This ensures we get a fresh connection from PgBouncer's pool
                    if ($this->isPreparedStatementError($e)) {
                        Log::info('Prepared statement error detected - purging all database connections');
                        DB::purge();
                    } else {
                        // For other connection errors, just disconnect the default connection
                        DB::disconnect();
                    }
                    
                    // Wait before retrying with exponential backoff
                    usleep(100000 * $attempt); // 100ms, 200ms, 300ms
                    
                    continue;
                }
                
                // If it's not a connection error or we've exhausted retries, throw
                Log::error('Database error after retries exhausted', [
                    'error' => $e->getMessage(),
                    'code' => $e->getCode(),
                    'attempts' => $attempt,
                    'url' => $request->url(),
                    'method' => $request->method()
                ]);
                
                throw $e;
            } catch (\Exception $e) {
                // For non-PDO exceptions, don't retry
                throw $e;
            }
        }

        // This should never be reached, but just in case
        return $next($request);
    }

    /**
     * Check if the exception is a prepared statement error specifically
     */
    protected function isPreparedStatementError(PDOException $e): bool
    {
        $message = strtolower($e->getMessage());
        
        return (
            strpos($message, 'prepared statement') !== false &&
            strpos($message, 'does not exist') !== false
        ) || (
            $e->getCode() === '26000' // PostgreSQL invalid SQL statement name
        );
    }

    /**
     * Check if the exception is a connection-related error
     */
    protected function isConnectionError(PDOException $e): bool
    {
        $connectionErrors = [
            'prepared statement',
            'connection',
            'server has gone away',
            'lost connection',
            'timeout',
            'broken pipe',
            'reset by peer',
            'does not exist',
            'invalid sql statement name',
        ];

        $message = strtolower($e->getMessage());
        
        foreach ($connectionErrors as $error) {
            if (strpos($message, $error) !== false) {
                return true;
            }
        }

        // Check for specific error codes
        $connectionErrorCodes = [
            2006,  // MySQL server has gone away
            2013,  // Lost connection to MySQL server during query
            '26000', // PostgreSQL prepared statement error (string format)
            26000,   // PostgreSQL prepared statement error (int format)
        ];

        return in_array($e->getCode(), $connectionErrorCodes, false);
    }
}
