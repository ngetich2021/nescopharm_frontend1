<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use App\Models\Customer;

class WhatsAppController extends Controller
{
    public function sendPhoneNumberOTP($phone_number)
    {
        // Validate the phone number
        $otp = rand(100000, 999999);

        // Find the customer by phone number
        $customer = Customer::where('phone_number', $phone_number)->first();

        if ($customer) {
            // Save the OTP in the database
            $customer->phone_verification_code = $otp;
            $customer->save();

            $client = new Client();
            $accessToken = env('WHATSAPP_ACCESS_TOKEN');
            $phoneNumberId = env('WHATSAPP_PHONE_NUMBER_ID');
    
            try {
                $response = $client->post("https://graph.facebook.com/v13.0/$phoneNumberId/messages", [
                    'headers' => [
                        'Authorization' => "Bearer $accessToken",
                        'Content-Type' => 'application/json',
                    ],
                    'json' => [
                        'messaging_product' => 'whatsapp',
                        'recipient_type' => 'individual',
                        'to' => $phone_number,
                        'type' => 'template',
                        'template' => [
                            'name' => 'sendplum_otp',
                            'language' => [
                                'code' => 'en_US'
                            ],
                            'components' => [
                                [
                                    'type' => 'body',
                                    'parameters' => [
                                        [
                                            'type' => 'text',
                                            'text' => $otp
                                        ]
                                    ]
                                ],
                                [
                                    'type' => 'button',
                                    'sub_type' => 'url',
                                    'index' => '0',
                                    'parameters' => [
                                        [
                                            'type' => 'text',
                                            'text' => $otp
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ],
                ]);
    
                if ($response->getStatusCode() == 200) {
                    return response()->json([
                        'status' => 'success',
                        'message' => 'OTP sent successfully',
                        'otp' => $otp]);
                } else {
                    Log::error('Error sending OTP: ' . $response->getBody());
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Failed to send OTP'], 500);
                }
            } catch (\GuzzleHttp\Exception\ClientException $e) {
                Log::error('ClientException: ' . $e->getMessage());
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to send OTP'], 500);
            } catch (\Exception $e) {
                Log::error('Exception: ' . $e->getMessage());
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to send OTP'], 500);
            }
        } else {
            return response()->json([
                'status' => 'failed',
                'message' => 'Customer not found'], 404);
        }

    }
}