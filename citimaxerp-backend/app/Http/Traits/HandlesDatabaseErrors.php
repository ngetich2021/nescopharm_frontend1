<?php

namespace App\Http\Traits;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PDOException;
use Exception;

trait HandlesDatabaseErrors
{
    /**
     * Execute a database operation with automatic retry on connection errors
     *
     * @param callable $callback
     * @param int $maxRetries
     * @return mixed
     * @throws Exception
     */
    protected function executeWithRetry(callable $callback, int $maxRetries = 3)
    {
        $attempt = 0;
        
        while ($attempt <= $maxRetries) {
            try {
                return $callback();
            } catch (PDOException $e) {
                $attempt++;
                
                // Check if this is a connection-related error
                if ($this->isDatabaseConnectionError($e) && $attempt <= $maxRetries) {
                    Log::warning("Database connection error in controller, attempt {$attempt}/{$maxRetries}", [
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'controller' => static::class
                    ]);
                    
                    // Disconnect and wait before retrying
                    DB::purge();
                    usleep(100000 * $attempt); // 100ms, 200ms, 300ms
                    
                    continue;
                }
                
                // If it's not a connection error or we've exhausted retries
                Log::error('Database error after retries exhausted in controller', [
                    'error' => $e->getMessage(),
                    'code' => $e->getCode(),
                    'attempts' => $attempt,
                    'controller' => static::class
                ]);
                
                throw $e;
            }
        }
        
        return null; // Should never reach here
    }

    /**
     * Check if the exception is a database connection-related error
     *
     * @param PDOException $e
     * @return bool
     */
    protected function isDatabaseConnectionError(PDOException $e): bool
    {
        // First check for specific PostgreSQL errors that are NOT connection errors
        $message = strtolower($e->getMessage());
        $nonConnectionErrors = [
            'operator does not exist',
            'undefined function',
            'syntax error',
            'column does not exist',
            'relation does not exist',
            'type does not exist'
        ];
        
        foreach ($nonConnectionErrors as $error) {
            if (strpos($message, $error) !== false) {
                return false; // This is a query/schema error, not a connection error
            }
        }
        
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
            'no connection to the server',
        ];
        
        foreach ($connectionErrors as $error) {
            if (strpos($message, $error) !== false) {
                return true;
            }
        }

        // Check for specific error codes
        $connectionErrorCodes = [
            2006, // MySQL server has gone away
            2013, // Lost connection to MySQL server during query
            26000, // PostgreSQL prepared statement error
            7,    // PostgreSQL connection error
        ];

        return in_array($e->getCode(), $connectionErrorCodes);
    }

    /**
     * Handle database errors and return a user-friendly response
     *
     * @param Exception $e
     * @param string $operation
     * @return \Illuminate\Http\JsonResponse
     */
    protected function handleDatabaseError(Exception $e, string $operation = 'database operation')
    {
        Log::error("Database error during {$operation}", [
            'error' => $e->getMessage(),
            'code' => $e->getCode(),
            'controller' => static::class,
            'trace' => $e->getTraceAsString()
        ]);

        // Check if it's a connection error
        if ($e instanceof PDOException && $this->isDatabaseConnectionError($e)) {
            return response()->json([
                'status' => 'error',
                'message' => 'A database connection error occurred. Please refresh the page or contact support if this continues.',
                'error_type' => 'database_connection_error'
            ], 500);
        }

        // Generic database error response
        return response()->json([
            'status' => 'error',
            'message' => 'A database error occurred. Please refresh the page or contact support if this continues.',
            'error_type' => 'database_error'
        ], 500);
    }
}
