<?php

namespace App\Database;

use Illuminate\Database\PostgresConnection as BasePostgresConnection;

/**
 * With emulated prepares (needed behind the connection pooler) Laravel turns a boolean binding
 * into the integer 1/0, which is pasted into the SQL as-is - and Postgres refuses
 * "boolean = integer", so any ->where('is_active', true) failed. Sent as the strings '1'/'0'
 * instead, Postgres reads them as booleans for boolean columns and as numbers for integer ones.
 */
class PostgresConnection extends BasePostgresConnection
{
    public function prepareBindings(array $bindings)
    {
        foreach ($bindings as $key => $value) {
            if (is_bool($value)) {
                $bindings[$key] = $value ? '1' : '0';
            }
        }

        return parent::prepareBindings($bindings);
    }
}
