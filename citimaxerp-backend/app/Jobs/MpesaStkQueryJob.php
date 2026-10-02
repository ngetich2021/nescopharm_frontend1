<?php
namespace App\Jobs;

use App\Models\MpesaTransaction;
use App\Models\CompanyMpesaConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class MpesaStkQueryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $transactionId;

    public function __construct($transactionId)
    {
        $this->transactionId = $transactionId;
    }

    public function handle()
    {
        $transaction = MpesaTransaction::find($this->transactionId);
        if (!$transaction || !$transaction->checkout_request_id) {
            Log::error('STK Query: Transaction or CheckoutRequestID missing', ['transaction_id' => $this->transactionId]);
            return;
        }
        $config = CompanyMpesaConfig::where('company_id', $transaction->company_id)
            ->where('is_active', true)
            ->first();
        if (!$config) {
            Log::error('STK Query: Mpesa config not found', ['company_id' => $transaction->company_id]);
            return;
        }
        // Use correct credentials for environment
        if ($config->environment === 'sandbox') {
            $shortcode = '174379';
            $passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
            $consumerKey = '2PsymQaGFWEFw8cPM2wAeo80jdhNFw6wjRuG3YFXiGLMWwpv';
            $consumerSecret = 'fyolAW6Hd4h80WnTOvnbxAuOMb24qGtWUkDwPy49cc4QzpBk5fpFkqezXFMtpGEz';
        } else {
            $shortcode = $config->shortcode ? $config->shortcode : $config->paybill_number;
            $passkey = $config->passkey;
            $consumerKey = $config->consumer_key;
            $consumerSecret = $config->consumer_secret;
        }
        $timestamp = date('YmdHis');
        $password = base64_encode($shortcode . $passkey . $timestamp);

        $maxAttempts = 3;
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            // Get access token
            $tokenUrl = ($config->environment === 'production')
                ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
                : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
            $ch = curl_init($tokenUrl);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Basic ' . base64_encode($consumerKey . ':' . $consumerSecret)
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $tokenResponse = curl_exec($ch);
            curl_close($ch);
            $tokenData = json_decode($tokenResponse, true);
            $accessToken = isset($tokenData['access_token']) ? $tokenData['access_token'] : null;
            if (!$accessToken) {
                Log::error('STK Query: Failed to get access token', ['transaction_id' => $this->transactionId, 'attempt' => $attempt]);
                if ($attempt < $maxAttempts) sleep(5);
                continue;
            }
            // Prepare STK Query payload
            $queryPayload = [
                'BusinessShortCode' => $shortcode,
                'Password' => $password,
                'Timestamp' => $timestamp,
                'CheckoutRequestID' => $transaction->checkout_request_id,
            ];
            $stkQueryUrl = ($config->environment === 'production')
                ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
                : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
            $ch = curl_init($stkQueryUrl);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken
            ]);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($queryPayload));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $queryResponse = curl_exec($ch);
            curl_close($ch);
            $queryData = json_decode($queryResponse, true);
            // Update transaction with query response
            $transaction->raw_response = $queryResponse;
            if (isset($queryData['ResultCode'])) {
                $transaction->status = ($queryData['ResultCode'] == 0 || $queryData['ResultCode'] == '0') ? 'completed' : 'failed';
                $transaction->result_code = $queryData['ResultCode'];
                $transaction->result_desc = $queryData['ResultDesc'] ?? null;
                $transaction->mpesa_receipt_number = $queryData['MpesaReceiptNumber'] ?? null;
                $transaction->save();
                // If completed or failed with a final result, break
                if ($queryData['ResultCode'] == 0 || $queryData['ResultCode'] == '0' || $attempt == $maxAttempts) {
                    break;
                }
            }
            if ($attempt < $maxAttempts) sleep(5);
        }
    }
}
