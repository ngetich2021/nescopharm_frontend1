<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes on the columns pages look rows up by, which had none.
 * Production stats (2026-11-12): order_items was scanned whole 1.3 million
 * times (2.2 billion rows read) because order_id had no index.
 * Each index is created only when the table and column exist and no index
 * already starts with that column, so this is safe on every database.
 */
return new class extends Migration
{
    private array $indexes = [
        'order_items' => ['order_id', 'company_id'],
        'orders' => ['sales_rep_id', 'delivery_location_id'],
        'invoices' => ['order_id', 'customer_id', 'payment_id'],
        'payments' => ['customer_id', 'order_id', 'company_id'],
        'payment_allocations' => ['invoice_id', 'payment_id'],
        'customers' => ['account_id'],
        'customer_accounts' => ['customer_id', 'company_id'],
        'products' => ['vat_category_id', 'income_account_id'],
        'notifications' => ['notifiable_id'],
        'inventory_batches' => ['product_receipt_id', 'supplier_id'],
        'product_receipt_items' => ['product_receipt_id', 'product_id', 'variant_id'],
        'personal_access_tokens' => ['tokenable_id'],
        'order_dispatches' => ['order_id'],
        'cheques' => ['customer_id', 'invoice_id', 'payment_id', 'supplier_id'],
        'invoice_line_items' => ['invoice_id', 'variant_id'],
        'chart_of_accounts' => ['parent_id'],
        'credit_notes' => ['invoice_id', 'customer_id'],
        'quote_items' => ['quote_id'],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column) || $this->hasLeadingIndex($table, $column)) {
                    continue;
                }
                DB::statement(sprintf(
                    'CREATE INDEX IF NOT EXISTS "%s" ON "%s" ("%s")',
                    $this->name($table, $column), $table, $column
                ));
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes as $table => $columns) {
            foreach ($columns as $column) {
                DB::statement(sprintf('DROP INDEX IF EXISTS "%s"', $this->name($table, $column)));
            }
        }
    }

    private function name(string $table, string $column): string
    {
        return "speed_{$table}_{$column}_idx";
    }

    private function hasLeadingIndex(string $table, string $column): bool
    {
        return DB::selectOne(
            "select 1 as found from pg_index i
               join pg_class t on t.oid = i.indrelid
               join pg_namespace n on n.oid = t.relnamespace
               join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
              where n.nspname = current_schema() and t.relname = ? and a.attname = ?
              limit 1",
            [$table, $column]
        ) !== null;
    }
};
