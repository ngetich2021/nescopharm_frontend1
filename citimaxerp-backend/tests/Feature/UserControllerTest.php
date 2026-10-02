<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    /**
     * Test user login.
     *
     * @return void
     */
    public function testUserLogin()
    {
        $password = $this->faker->password(8);
        $user = User::factory()->create([
            'password' => Hash::make($password)
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => $password
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'email_verified_at',
                    'phone_number',
                    'phone_verified_at',
                    'created_at',
                    'updated_at'
                ],
                'token'
            ]);
    }

    /**
     * Test user logout.
     *
     * @return void
     */
    public function testUserLogout()
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/logout');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'User logged out successfully'
            ]);
    }

    /**
     * Test user email verification code sending.
     *
     * @return void
     */
    public function testSendEmailVerificationCode()
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/send-email-verification-code', [
            'email' => $user->email
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Verification code sent'
            ]);
    }

    /**
     * Test user email verification.
     *
     * @return void
     */
    public function testVerifyEmail()
    {
        $user = User::factory()->create([
            'email_verified_at' => null,
            'email_verification_code' => 123456
        ]);

        $response = $this->postJson('/api/verify-email', [
            'email' => $user->email,
            'verification_code' => 123456
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'email_verified_at',
                    'phone_number',
                    'phone_verified_at',
                    'created_at',
                    'updated_at'
                ]
            ]);
    }

    /**
     * Test user phone verification code sending.
     *
     * @return void
     */
    public function testSendPhoneVerificationCode()
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/send-phone-verification-code', [
            'phone_number' => $user->phone_number,
            'country_code' => 'US'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Verification code sent'
            ]);
    }

    /**
     * Test user phone verification.
     *
     * @return void
     */
    public function testVerifyPhone()
    {
        $user = User::factory()->create([
            'phone_verified_at' => null,
            'phone_verification_code' => 123456
        ]);

        $response = $this->postJson('/api/verify-phone', [
            'phone_number' => $user->phone_number,
            'verification_code' => 123456
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'email_verified_at',
                    'phone_number',
                    'phone_verified_at',
                    'created_at',
                    'updated_at'
                ]
            ]);
    }

    /**
     * Test user password creation.
     *
     * @return void
     */
    public function testCreatePassword()
    {
        $password = $this->faker->password(8);
        $user = User::factory()->create();

        $response = $this->postJson('/api/create-password', [
            'user_id' => $user->id,
            'password' => $password,
            'confirm_password' => $password
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'email_verified_at',
                    'phone_number',
                    'phone_verified_at',
                    'created_at',
                    'updated_at'
                ]
            ]);
    }
}