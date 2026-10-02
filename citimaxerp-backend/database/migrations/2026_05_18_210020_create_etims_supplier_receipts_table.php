<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // AP-side: uploaded supplier receipts/invoices that we verify against
        // DigiTax for VAT reclaim. Each verified receipt can link to Citimax's
        // accounts_payable record after matching.
        Schema::create('etims_supplier_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->uuid('supplier_bill_id')->nullable();    // linked AP record (nullable until matched)
            $table->uuid('supplier_id')->nullable();
            $table->uuid('uploaded_by');

            // Source artifact
            $table->string('upload_path')->nullable();       // S3/Cloud-Bucket path of original PDF/image
            $table->string('upload_mime', 64)->nullable();

            // Extracted KRA artifacts
            $table->string('supplier_kra_pin')->nullable();
            $table->string('trader_invoice_number')->nullable();
            $table->text('qr_payload')->nullable();          // raw QR text/url
            $table->text('etims_signature')->nullable();
            $table->date('invoice_date')->nullable();
            $table->decimal('total_amount', 15, 2)->nullable();
            $table->decimal('tax_amount', 15, 2)->nullable();
            $table->string('currency', 3)->default('KES');

            // Verification state
            $table->string('verification_status', 24)->default('pending'); // pending, verified, invalid, error
            $table->text('verification_error')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->boolean('vat_reclaimable')->default(false);

            // Raw DigiTax verify response for forensic
            $table->json('digitax_verify_payload')->nullable();

            $table->timestamps();

            $table->index(['company_id', 'verification_status'], 'etims_supplier_receipts_status_idx');
            $table->index(['supplier_bill_id'], 'etims_supplier_receipts_bill_idx');
            $table->index(['supplier_kra_pin'], 'etims_supplier_receipts_pin_idx');
            $table->unique(['company_id', 'trader_invoice_number', 'supplier_kra_pin'], 'etims_supplier_receipts_uniq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etims_supplier_receipts');
    }
};
