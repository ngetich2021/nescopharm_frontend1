<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    /**
     * RefreshDatabase and DatabaseMigrations drop every table, so a test using them only runs on
     * a database on this machine. This wiped the dev database once (2026-11-04).
     */
    protected function setUpTraits()
    {
        $uses = class_uses_recursive(static::class);
        if (isset($uses[RefreshDatabase::class]) || isset($uses[DatabaseMigrations::class])) {
            $host = config('database.connections.' . config('database.default') . '.host');
            if ($host !== null && !in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
                throw new RuntimeException("Refusing to reset the database on {$host}: " . static::class . ' drops every table.');
            }
        }

        return parent::setUpTraits();
    }
}
