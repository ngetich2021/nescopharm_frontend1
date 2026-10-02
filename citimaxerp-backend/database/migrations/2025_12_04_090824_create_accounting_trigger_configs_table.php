<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Table for trigger categories (sales, purchase, expense, etc.)
        Schema::create('accounting_trigger_categories', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id')->nullable(); // null = system-wide (available to all)
            $table->string('code', 50); // e.g., 'sales', 'purchase', 'expense'
            $table->string('name', 100); // e.g., 'Sales Recognition'
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code'], 'unique_category_code');
        });

        // Table for individual triggers within each category
        Schema::create('accounting_trigger_configs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id')->nullable(); // null = system-wide default
            $table->uuid('category_id');
            $table->string('trigger_key', 50); // e.g., 'order_delivered', 'invoice_sent'
            $table->string('trigger_name', 100); // e.g., 'When Order is Delivered'
            $table->text('description')->nullable();
            $table->string('event_class', 255)->nullable(); // Laravel event class to listen for
            $table->string('model_class', 255)->nullable(); // Model that triggers this
            $table->string('model_status', 50)->nullable(); // Status that triggers (e.g., 'delivered')
            $table->json('conditions')->nullable(); // Additional conditions as JSON
            $table->string('journal_type', 50)->default('standard'); // Type of journal to create
            $table->json('debit_accounts')->nullable(); // Account mapping keys for debits
            $table->json('credit_accounts')->nullable(); // Account mapping keys for credits
            $table->boolean('is_system')->default(false); // System triggers can't be deleted
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false); // Default trigger for this category
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('category_id')->references('id')->on('accounting_trigger_categories')->onDelete('cascade');
            
            // Unique constraint: one trigger_key per category per company (or system-wide)
            $table->unique(['company_id', 'category_id', 'trigger_key'], 'unique_trigger_per_category');
        });

        // Seed default system triggers
        $this->seedDefaultTriggers();
    }

    /**
     * Seed default system-wide triggers
     */
    private function seedDefaultTriggers(): void
    {
        $now = now();

        // Create categories - use DB::raw for boolean values in PostgreSQL with PgBouncer
        $salesCategoryId = \Illuminate\Support\Str::uuid()->toString();
        DB::table('accounting_trigger_categories')->insert([
            'id' => $salesCategoryId,
            'company_id' => null,
            'code' => 'sales',
            'name' => 'Sales Recognition',
            'description' => 'Triggers for recognizing sales revenue in the accounting system',
            'is_active' => DB::raw('true'),
            'sort_order' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $purchaseCategoryId = \Illuminate\Support\Str::uuid()->toString();
        DB::table('accounting_trigger_categories')->insert([
            'id' => $purchaseCategoryId,
            'company_id' => null,
            'code' => 'purchase',
            'name' => 'Purchase Recognition',
            'description' => 'Triggers for recognizing purchases and accounts payable',
            'is_active' => DB::raw('true'),
            'sort_order' => 2,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $expenseCategoryId = \Illuminate\Support\Str::uuid()->toString();
        DB::table('accounting_trigger_categories')->insert([
            'id' => $expenseCategoryId,
            'company_id' => null,
            'code' => 'expense',
            'name' => 'Expense Recognition',
            'description' => 'Triggers for recognizing expenses',
            'is_active' => DB::raw('true'),
            'sort_order' => 3,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // Sales triggers
        $salesTriggers = [
            ['trigger_key' => 'order_created', 'trigger_name' => 'When Order is Created', 'description' => 'Record revenue when a sales order is created', 'model_class' => 'App\\Models\\Order', 'model_status' => 'created', 'is_default' => false, 'sort_order' => 1],
            ['trigger_key' => 'order_completed', 'trigger_name' => 'When Order is Completed', 'description' => 'Record revenue when a sales order is marked as completed', 'model_class' => 'App\\Models\\Order', 'model_status' => 'completed', 'is_default' => false, 'sort_order' => 2],
            ['trigger_key' => 'order_dispatched', 'trigger_name' => 'When Order is Dispatched', 'description' => 'Record revenue when goods are dispatched', 'model_class' => 'App\\Models\\OrderDispatch', 'model_status' => 'dispatched', 'is_default' => false, 'sort_order' => 3],
            ['trigger_key' => 'order_delivered', 'trigger_name' => 'When Order is Delivered', 'description' => 'Record revenue when delivery is confirmed through dispatch process', 'model_class' => 'App\\Models\\OrderDispatch', 'model_status' => 'delivered', 'is_default' => false, 'sort_order' => 4],
            ['trigger_key' => 'invoice_created', 'trigger_name' => 'When Invoice is Created', 'description' => 'Record revenue when invoice is created', 'model_class' => 'App\\Models\\Invoice', 'model_status' => 'created', 'is_default' => false, 'sort_order' => 5],
            ['trigger_key' => 'invoice_sent', 'trigger_name' => 'When Invoice is Sent', 'description' => 'Record revenue when invoice is sent to customer (Recommended)', 'model_class' => 'App\\Models\\Invoice', 'model_status' => 'sent', 'is_default' => true, 'sort_order' => 6],
            ['trigger_key' => 'invoice_approved', 'trigger_name' => 'When Invoice is Approved', 'description' => 'Record revenue when invoice is approved', 'model_class' => 'App\\Models\\Invoice', 'model_status' => 'approved', 'is_default' => false, 'sort_order' => 7],
            ['trigger_key' => 'payment_received', 'trigger_name' => 'When Payment is Received', 'description' => 'Record revenue only when payment is received (Cash Basis)', 'model_class' => 'App\\Models\\Payment', 'model_status' => 'completed', 'is_default' => false, 'sort_order' => 8],
            ['trigger_key' => 'manual', 'trigger_name' => 'Manual Entry Only', 'description' => 'No automatic journal entries - require manual creation', 'model_class' => null, 'model_status' => null, 'is_default' => false, 'sort_order' => 99],
        ];

        foreach ($salesTriggers as $trigger) {
            DB::table('accounting_trigger_configs')->insert([
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'company_id' => null,
                'category_id' => $salesCategoryId,
                'trigger_key' => $trigger['trigger_key'],
                'trigger_name' => $trigger['trigger_name'],
                'description' => $trigger['description'],
                'model_class' => $trigger['model_class'],
                'model_status' => $trigger['model_status'],
                'journal_type' => 'sales',
                'debit_accounts' => json_encode(['accounts_receivable']),
                'credit_accounts' => json_encode(['sales_revenue', 'vat_output']),
                'is_system' => DB::raw('true'),
                'is_active' => DB::raw('true'),
                'is_default' => DB::raw($trigger['is_default'] ? 'true' : 'false'),
                'sort_order' => $trigger['sort_order'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Purchase triggers
        $purchaseTriggers = [
            ['trigger_key' => 'purchase_created', 'trigger_name' => 'When Purchase Order is Created', 'description' => 'Record liability when purchase order is created', 'model_class' => 'App\\Models\\PurchaseOrder', 'model_status' => 'created', 'is_default' => false, 'sort_order' => 1],
            ['trigger_key' => 'purchase_approved', 'trigger_name' => 'When Purchase Order is Approved', 'description' => 'Record liability when purchase order is approved', 'model_class' => 'App\\Models\\PurchaseOrder', 'model_status' => 'approved', 'is_default' => false, 'sort_order' => 2],
            ['trigger_key' => 'goods_received', 'trigger_name' => 'When Goods are Received', 'description' => 'Record liability when goods are received (Recommended)', 'model_class' => 'App\\Models\\GoodsReceipt', 'model_status' => 'received', 'is_default' => true, 'sort_order' => 3],
            ['trigger_key' => 'payment_made', 'trigger_name' => 'When Payment is Made', 'description' => 'Record expense only when payment is made (Cash Basis)', 'model_class' => 'App\\Models\\SupplierPayment', 'model_status' => 'completed', 'is_default' => false, 'sort_order' => 4],
            ['trigger_key' => 'manual', 'trigger_name' => 'Manual Entry Only', 'description' => 'No automatic journal entries - require manual creation', 'model_class' => null, 'model_status' => null, 'is_default' => false, 'sort_order' => 99],
        ];

        foreach ($purchaseTriggers as $trigger) {
            DB::table('accounting_trigger_configs')->insert([
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'company_id' => null,
                'category_id' => $purchaseCategoryId,
                'trigger_key' => $trigger['trigger_key'],
                'trigger_name' => $trigger['trigger_name'],
                'description' => $trigger['description'],
                'model_class' => $trigger['model_class'],
                'model_status' => $trigger['model_status'],
                'journal_type' => 'purchase',
                'debit_accounts' => json_encode(['inventory', 'vat_input']),
                'credit_accounts' => json_encode(['accounts_payable']),
                'is_system' => DB::raw('true'),
                'is_active' => DB::raw('true'),
                'is_default' => DB::raw($trigger['is_default'] ? 'true' : 'false'),
                'sort_order' => $trigger['sort_order'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Expense triggers
        $expenseTriggers = [
            ['trigger_key' => 'expense_created', 'trigger_name' => 'When Expense is Created', 'description' => 'Record expense when it is submitted', 'model_class' => 'App\\Models\\Expense', 'model_status' => 'pending', 'is_default' => false, 'sort_order' => 1],
            ['trigger_key' => 'expense_approved', 'trigger_name' => 'When Expense is Approved', 'description' => 'Record expense when it is approved (Recommended)', 'model_class' => 'App\\Models\\Expense', 'model_status' => 'approved', 'is_default' => true, 'sort_order' => 2],
            ['trigger_key' => 'expense_paid', 'trigger_name' => 'When Expense is Paid', 'description' => 'Record expense only when payment is made (Cash Basis)', 'model_class' => 'App\\Models\\Expense', 'model_status' => 'paid', 'is_default' => false, 'sort_order' => 3],
            ['trigger_key' => 'manual', 'trigger_name' => 'Manual Entry Only', 'description' => 'No automatic journal entries - require manual creation', 'model_class' => null, 'model_status' => null, 'is_default' => false, 'sort_order' => 99],
        ];

        foreach ($expenseTriggers as $trigger) {
            DB::table('accounting_trigger_configs')->insert([
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'company_id' => null,
                'category_id' => $expenseCategoryId,
                'trigger_key' => $trigger['trigger_key'],
                'trigger_name' => $trigger['trigger_name'],
                'description' => $trigger['description'],
                'model_class' => $trigger['model_class'],
                'model_status' => $trigger['model_status'],
                'journal_type' => 'expense',
                'debit_accounts' => json_encode(['general_expense']),
                'credit_accounts' => json_encode(['cash', 'bank']),
                'is_system' => DB::raw('true'),
                'is_active' => DB::raw('true'),
                'is_default' => DB::raw($trigger['is_default'] ? 'true' : 'false'),
                'sort_order' => $trigger['sort_order'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounting_trigger_configs');
        Schema::dropIfExists('accounting_trigger_categories');
    }
};
