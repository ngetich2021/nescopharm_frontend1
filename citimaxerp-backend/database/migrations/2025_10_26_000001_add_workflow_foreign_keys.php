<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration adds foreign keys that reference tables created later
     * in the migration sequence. It must run AFTER all referenced tables exist.
     */
    public function up(): void
    {
        // Add product foreign keys (references product_categories and suppliers)
        if (Schema::hasTable('products') && Schema::hasTable('product_categories')) {
            Schema::table('products', function (Blueprint $table) {
                if (!$this->foreignKeyExists('products', 'products_category_id_foreign')) {
                    $table->foreign('category_id')->references('id')->on('product_categories')->onDelete('set null');
                }
            });
        }

        if (Schema::hasTable('products') && Schema::hasTable('suppliers')) {
            Schema::table('products', function (Blueprint $table) {
                if (!$this->foreignKeyExists('products', 'products_supplier_id_foreign')) {
                    $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('set null');
                }
            });
        }

        // Add unit_id foreign key to order_items (references product_packaging_units)
        if (Schema::hasTable('order_items') && Schema::hasTable('product_packaging_units')) {
            Schema::table('order_items', function (Blueprint $table) {
                if (!$this->foreignKeyExists('order_items', 'order_items_unit_id_foreign')) {
                    $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
                }
            });
        }

        // Add unit_id foreign key to quote_items (references product_packaging_units)
        if (Schema::hasTable('quote_items') && Schema::hasTable('product_packaging_units')) {
            Schema::table('quote_items', function (Blueprint $table) {
                if (!$this->foreignKeyExists('quote_items', 'quote_items_unit_id_foreign')) {
                    $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
                }
            });
        }

        // Add unit_id foreign key to purchase_order_items (references product_packaging_units)
        if (Schema::hasTable('purchase_order_items') && Schema::hasTable('product_packaging_units')) {
            Schema::table('purchase_order_items', function (Blueprint $table) {
                if (!$this->foreignKeyExists('purchase_order_items', 'purchase_order_items_unit_id_foreign')) {
                    $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
                }
            });
        }

        // Add invoice_id foreign key to payments (references invoices)
        if (Schema::hasTable('payments') && Schema::hasTable('invoices')) {
            Schema::table('payments', function (Blueprint $table) {
                if (!$this->foreignKeyExists('payments', 'payments_invoice_id_foreign')) {
                    $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('set null');
                }
            });
        }

        // Add workflow foreign keys to customers table
        if (Schema::hasTable('customers') && Schema::hasTable('approval_workflow_instances')) {
            Schema::table('customers', function (Blueprint $table) {
                if (!$this->foreignKeyExists('customers', 'customers_workflow_instance_id_foreign')) {
                    $table->foreign('workflow_instance_id')->references('id')->on('approval_workflow_instances')->onDelete('set null');
                }
            });
        }

        // Add workflow foreign keys to customer_accounts table
        if (Schema::hasTable('customer_accounts') && Schema::hasTable('approval_workflow_instances')) {
            Schema::table('customer_accounts', function (Blueprint $table) {
                if (!$this->foreignKeyExists('customer_accounts', 'customer_accounts_workflow_instance_id_foreign')) {
                    $table->foreign('workflow_instance_id')->references('id')->on('approval_workflow_instances')->onDelete('set null');
                }
            });
        }

        // Add workflow foreign keys to dispatches table
        if (Schema::hasTable('dispatches') && Schema::hasTable('approval_workflow_instances')) {
            Schema::table('dispatches', function (Blueprint $table) {
                if (!$this->foreignKeyExists('dispatches', 'dispatches_workflow_instance_id_foreign')) {
                    $table->foreign('workflow_instance_id')->references('id')->on('approval_workflow_instances')->onDelete('set null');
                }
            });
        }
    }

    /**
     * Helper method to check if a foreign key exists
     */
    private function foreignKeyExists(string $table, string $foreignKey): bool
    {
        $conn = Schema::getConnection();
        $dbSchemaManager = $conn->getDoctrineSchemaManager();
        $foreignKeys = $dbSchemaManager->listTableForeignKeys($table);
        
        foreach ($foreignKeys as $fk) {
            if ($fk->getName() === $foreignKey) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropForeign(['supplier_id']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['unit_id']);
        });

        Schema::table('quote_items', function (Blueprint $table) {
            $table->dropForeign(['unit_id']);
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropForeign(['unit_id']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropForeign(['workflow_instance_id']);
        });

        Schema::table('customer_accounts', function (Blueprint $table) {
            $table->dropForeign(['workflow_instance_id']);
        });

        Schema::table('dispatches', function (Blueprint $table) {
            $table->dropForeign(['workflow_instance_id']);
        });
    }
};
