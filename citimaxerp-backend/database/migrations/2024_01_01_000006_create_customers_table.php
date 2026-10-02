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
        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('status')->default('active');
            $table->string('approval_status')->default('draft');
            $table->uuid('workflow_instance_id')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable();
            $table->text('company')->nullable();
            $table->text('address')->nullable();
            $table->text('city')->nullable();
            $table->text('state')->nullable();
            $table->text('country')->nullable();
            $table->text('postal_code')->nullable();
            $table->text('notes')->nullable();
            $table->jsonb('tags')->nullable();
            $table->text('preferred_communication_channel')->nullable();
            $table->timestamp('last_contact_date')->nullable();
            $table->text('customer_type')->nullable();
            $table->decimal('total_spend', 10, 2)->nullable()->default(0);
            $table->integer('total_orders')->nullable()->default(0);
            $table->integer('loyalty_points')->nullable()->default(0);
            $table->text('timestamp')->nullable();
            $table->uuid('company_id')->nullable();
            $table->uuid('account_id')->nullable();
            $table->string('business_name')->nullable();
            $table->string('nature_of_business')->nullable();
            $table->string('pin_number')->nullable();
            $table->string('payment_method')->default('cash');
            $table->string('contact_person_name')->nullable();
            $table->string('contact_person_phone')->nullable();
            $table->string('contact_person_email')->nullable();
            $table->uuid('created_by')->nullable();
            $table->string('customer_number')->nullable();
            $table->timestamp('deleted_at')->nullable();
            
            $table->foreign('company_id', 'customers_company_id_fkey')->references('id')->on('companies');

            $table->index('email', 'idx_customers_email');
            $table->index('phone', 'idx_customers_phone');
            $table->index('company_id', 'idx_customers_company_id');
            $table->index('customer_number', 'idx_customers_customer_number');
            $table->index(['approval_status']);
        });

        // Create partial unique index for email (PostgreSQL specific)
        DB::statement("CREATE UNIQUE INDEX customers_email_key_partial ON customers (email) WHERE email IS NOT NULL AND email != ''");

        DB::statement('
            CREATE TRIGGER update_customers_modtime
            BEFORE UPDATE ON customers
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_customers_modtime ON customers');
        Schema::dropIfExists('customers');
    }
};
