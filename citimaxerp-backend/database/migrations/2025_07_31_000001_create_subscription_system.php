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
        // Create subscription_plans table
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name'); // e.g., "Basic", "Premium", "Enterprise"
            $table->string('slug')->unique(); // e.g., "basic", "premium", "enterprise"
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2); // Monthly price
            $table->string('currency', 3)->default('KES');
            $table->enum('billing_cycle', ['monthly', 'quarterly', 'semi_annual', 'annual'])->default('monthly');
            $table->integer('max_users')->nullable(); // null means unlimited
            $table->integer('max_companies')->default(1); // For reseller plans
            $table->boolean('is_active')->default(true);
            $table->boolean('is_popular')->default(false);
            $table->json('features')->nullable(); // Array of features included
            $table->json('limitations')->nullable(); // Array of limitations
            $table->integer('trial_days')->default(14);
            $table->timestamps();
            
            $table->index(['is_active']);
            $table->index(['slug']);
        });

        // Create company_subscriptions table
        Schema::create('company_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('subscription_plan_id');
            $table->enum('status', ['trial', 'active', 'suspended', 'cancelled', 'expired'])->default('trial');
            $table->date('start_date');
            $table->date('end_date');
            $table->date('trial_end_date')->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('KES');
            $table->enum('billing_cycle', ['monthly', 'quarterly', 'semi_annual', 'annual'])->default('monthly');
            $table->date('next_billing_date')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->timestamp('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->json('metadata')->nullable(); // Additional subscription data
            $table->timestamps();
            
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('subscription_plan_id')->references('id')->on('subscription_plans')->onDelete('restrict');
            $table->foreign('cancelled_by')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['company_id', 'status']);
            $table->index(['status', 'end_date']);
            $table->index(['next_billing_date']);
            $table->unique(['company_id']); // One active subscription per company
        });

        // Create subscription_payments table
        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_subscription_id');
            $table->uuid('company_id');
            $table->string('payment_reference')->unique(); // Transaction reference
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('KES');
            $table->enum('payment_method', ['mpesa', 'bank_transfer', 'card', 'cash', 'other']);
            $table->enum('status', ['pending', 'completed', 'failed', 'refunded'])->default('pending');
            $table->date('payment_date');
            $table->date('period_start'); // Billing period start
            $table->date('period_end'); // Billing period end
            $table->text('payment_details')->nullable(); // JSON or text with payment gateway details
            $table->text('failure_reason')->nullable();
            $table->uuid('processed_by')->nullable(); // Admin who processed manual payment
            $table->timestamps();
            
            $table->foreign('company_subscription_id')->references('id')->on('company_subscriptions')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('processed_by')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['company_id', 'status']);
            $table->index(['payment_date']);
            $table->index(['status']);
        });

        // Add subscription_id to companies table
        Schema::table('companies', function (Blueprint $table) {
            $table->uuid('current_subscription_id')->nullable()->after('is_first_time');
            $table->foreign('current_subscription_id')->references('id')->on('company_subscriptions')->onDelete('set null');
            $table->index('current_subscription_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropForeign(['current_subscription_id']);
            $table->dropColumn('current_subscription_id');
        });
        
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('company_subscriptions');
        Schema::dropIfExists('subscription_plans');
    }
};
