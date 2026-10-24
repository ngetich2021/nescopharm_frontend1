<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Chat tab's models existed but their tables were never created, so every chat
 * screen failed with "relation conversations does not exist". Only missing tables are created.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('meta_platform_credentials')) {
            Schema::create('meta_platform_credentials', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->index();
                $table->string('platform', 20);
                $table->string('app_id')->nullable();
                $table->text('access_token')->nullable();
                $table->text('app_secret')->nullable();
                $table->string('phone_number_id')->nullable();
                $table->string('page_id')->nullable();
                $table->string('business_account_id')->nullable();
                $table->string('instagram_account_id')->nullable();
                $table->text('webhook_verify_token')->nullable();
                $table->json('additional_config')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
                $table->unique(['company_id', 'platform']);
            });
        }

        if (!Schema::hasTable('conversations')) {
            Schema::create('conversations', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->index();
                $table->uuid('customer_id')->nullable()->index();
                $table->string('platform', 20);
                $table->string('platform_conversation_id')->nullable();
                $table->string('platform_user_id')->nullable();
                $table->string('customer_name')->nullable();
                $table->string('customer_phone')->nullable();
                $table->string('customer_email')->nullable();
                $table->text('customer_profile_picture')->nullable();
                $table->string('status', 20)->default('active');
                $table->uuid('assigned_agent_id')->nullable()->index();
                $table->boolean('is_bot_active')->default(false);
                $table->timestamp('last_message_at')->nullable();
                $table->timestamp('last_customer_message_at')->nullable();
                $table->timestamp('last_agent_message_at')->nullable();
                $table->integer('unread_count')->default(0);
                $table->json('metadata')->nullable();
                $table->json('tags')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['company_id', 'platform', 'platform_user_id']);
            });
        }

        if (!Schema::hasTable('messages')) {
            Schema::create('messages', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('conversation_id')->index();
                $table->string('platform_message_id')->nullable()->index();
                $table->string('direction', 20);
                $table->string('sender_type', 20)->nullable();
                $table->uuid('sender_id')->nullable();
                $table->string('sender_name')->nullable();
                $table->string('message_type', 30)->default('text');
                $table->text('content')->nullable();
                $table->json('rich_content')->nullable();
                $table->text('media_url')->nullable();
                $table->string('media_type')->nullable();
                $table->bigInteger('media_size')->nullable();
                $table->text('caption')->nullable();
                $table->uuid('reply_to_message_id')->nullable();
                $table->string('status', 20)->default('sent');
                $table->timestamp('delivered_at')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->text('error_message')->nullable();
                $table->json('metadata')->nullable();
                $table->json('reactions')->nullable();
                $table->boolean('is_deleted')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('message_attachments')) {
            Schema::create('message_attachments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('message_id')->index();
                $table->string('filename')->nullable();
                $table->string('original_filename')->nullable();
                $table->string('mime_type')->nullable();
                $table->bigInteger('file_size')->nullable();
                $table->text('file_path')->nullable();
                $table->text('file_url')->nullable();
                $table->string('platform_file_id')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasTable('message_templates')) {
            Schema::create('message_templates', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->index();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('platform', 20)->nullable();
                $table->string('category')->nullable();
                $table->string('template_type')->nullable();
                $table->text('content')->nullable();
                $table->json('rich_content')->nullable();
                $table->json('variables')->nullable();
                $table->string('language_code', 10)->nullable();
                $table->string('platform_template_id')->nullable();
                $table->string('approval_status')->nullable();
                $table->boolean('is_active')->default(true);
                $table->uuid('created_by')->nullable();
                $table->json('additional_info')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('conversation_events')) {
            Schema::create('conversation_events', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('conversation_id')->index();
                $table->string('event_type');
                $table->uuid('triggered_by')->nullable();
                $table->json('event_data')->nullable();
                $table->text('description')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasTable('conversation_participants')) {
            Schema::create('conversation_participants', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('conversation_id')->index();
                $table->uuid('user_id')->nullable();
                $table->string('participant_id')->nullable();
                $table->string('participant_name')->nullable();
                $table->string('role')->nullable();
                $table->timestamp('joined_at')->nullable();
                $table->timestamp('left_at')->nullable();
                $table->boolean('is_active')->default(true);
            });
        }
    }

    public function down(): void
    {
        foreach (['conversation_participants', 'conversation_events', 'message_templates', 'message_attachments', 'messages', 'conversations', 'meta_platform_credentials'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
