<?php
namespace App\Http\Controllers;

use App\Models\MpesaTransaction;
use App\Models\Payment;
use App\Models\CompanyMpesaConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class MpesaTransactionController extends Controller
{
    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }
    
    public function triggerPayment(Request $request)
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            //'company_id' => 'required|string|exists:companies,id', // Remove from validation, will use user's company_id
            'customer_id' => 'nullable|string|exists:customers,id',
            'amount' => 'required|numeric|min:1',
            'phone_number' => 'required|string',
            'description' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();
            // Format phone number to include Kenya country code
            $formattedPhone = $request->phone_number;
            if (preg_match('/^0\d{9}$/', $formattedPhone)) {
                $formattedPhone = '254' . substr($formattedPhone, 1);
            } elseif (preg_match('/^\+254\d{9}$/', $formattedPhone)) {
                $formattedPhone = substr($formattedPhone, 1);
            }

            $mpesaTransaction = MpesaTransaction::create([
                'id' => (string) Str::uuid(),
                'company_id' => $user->company_id, // Use logged-in user's company_id
                'customer_id' => $request->customer_id,
                'amount' => $request->amount,
                'phone_number' => $formattedPhone,
                'transaction_type' => 'stk',
                'status' => 'pending',
                'description' => $request->description,
            ]);

            // Fetch Mpesa config for the company
            $config = CompanyMpesaConfig::where('company_id', $user->company_id)
                ->where('is_active', true)
                ->first();
            if (!$config) {
                throw new \Exception('Mpesa config not found or inactive for this company');
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

            // Prepare STK Push payload
            $stkPayload = [
                'BusinessShortCode' => $shortcode,
                'Password' => base64_encode($shortcode . $passkey . date('YmdHis')),
                'Timestamp' => date('YmdHis'),
                'TransactionType' => 'CustomerPayBillOnline',
                'Amount' => $request->amount,
                'PartyA' => $formattedPhone,
                'PartyB' => $shortcode,
                'PhoneNumber' => $formattedPhone,
                'CallBackURL' => $config->callback_url,
                'AccountReference' => $config->description ?? 'Payment',
                'TransactionDesc' => $request->description ?? 'Payment',
            ];

            // Get access token from Mpesa API
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
                throw new \Exception('Failed to get Mpesa access token');
            }

            // Send STK Push request
            $stkUrl = ($config->environment === 'production')
                ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
                : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
            $ch = curl_init($stkUrl);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken
            ]);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($stkPayload));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $stkResponse = curl_exec($ch);
            curl_close($ch);
            $stkData = json_decode($stkResponse, true);

            // Update transaction with response
            $mpesaTransaction->raw_response = $stkResponse;
            if (isset($stkData['ResponseCode']) && $stkData['ResponseCode'] == '0') {
                $mpesaTransaction->status = 'pending';
                $mpesaTransaction->checkout_request_id = isset($stkData['CheckoutRequestID']) ? $stkData['CheckoutRequestID'] : null;
            } else {
                $mpesaTransaction->status = 'failed';
            }
            $mpesaTransaction->save();

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Mpesa payment triggered successfully',
                'data' => $mpesaTransaction], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Mpesa payment trigger failed', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    public function handleIncomingPayment(Request $request)
    {
        // Accept raw callback data from Mpesa
        $data = $request->all();
        // Try to extract relevant fields from common Mpesa callback formats
        $paybillNumber = $data['BusinessShortCode'] ?? $data['paybill_number'] ?? null;
        $tillNumber = $data['BillRefNumber'] ?? $data['till_number'] ?? null;
        $amount = $data['TransAmount'] ?? $data['amount'] ?? null;
        $mpesaCode = $data['TransID'] ?? $data['mpesa_code'] ?? null;
        $phoneNumber = $data['MSISDN'] ?? $data['phone_number'] ?? null;
        $rawResponse = json_encode($data);

        // Map company using paybill/till number
        $config = CompanyMpesaConfig::where(function($q) use ($paybillNumber, $tillNumber) {
            if ($paybillNumber) {
                $q->where('paybill_number', $paybillNumber);
            }
            if ($tillNumber) {
                $q->orWhere('till_number', $tillNumber);
            }
        })->where('is_active', true)->first();
        $companyId = $config ? $config->company_id : null;

        // Validate required fields
        $validator = Validator::make([
            'company_id' => $companyId,
            'amount' => $amount,
            'mpesa_code' => $mpesaCode,
            'phone_number' => $phoneNumber,
        ], [
            'company_id' => 'required|string|exists:companies,id',
            'amount' => 'required|numeric|min:1',
            'mpesa_code' => 'required|string',
            'phone_number' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();
            $mpesaTransaction = MpesaTransaction::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'amount' => $amount,
                'mpesa_code' => $mpesaCode,
                'phone_number' => $phoneNumber,
                'paybill_number' => $paybillNumber,
                'till_number' => $tillNumber,
                'transaction_type' => 'incoming',
                'status' => 'completed',
                'raw_response' => $rawResponse,
            ]);
            // TODO: Attach to Payment record if matched
            // Payment::where('mpesa_code', $mpesaCode)->update([...]);
            DB::commit();
            return response()->json(['status' => 'success', 'data' => $mpesaTransaction], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Mpesa incoming payment failed', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view Mpesa transactions.',
            ], 403);
        }
        $query = MpesaTransaction::query();
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $user->company_id);
        } else if ($request->filled('company_id')) {
            $query->where('company_id', $request->company_id);
        }
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->transaction_type);
        }
        $transactions = $query->orderBy('created_at', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Mpesa transactions fetched successfully',
            'data' => $transactions
        ], 200);
    }

    public function handleStkCallback(Request $request)
    {
        $data = $request->all();
        $body = $data['Body']['stkCallback'] ?? null;
        if (!$body) {
            return response()->json(['status' => 'failed', 'message' => 'Invalid callback format'], 400);
        }
        $checkoutRequestId = $body['CheckoutRequestID'] ?? null;
        $merchantRequestId = $body['MerchantRequestID'] ?? null;
        $resultCode = $body['ResultCode'] ?? null;
        $resultDesc = $body['ResultDesc'] ?? null;
        $callbackMetadata = $body['CallbackMetadata']['Item'] ?? [];

        // Extract values from CallbackMetadata
        $amount = null;
        $mpesaReceiptNumber = null;
        $transactionDate = null;
        $phoneNumber = null;
        foreach ($callbackMetadata as $item) {
            if ($item['Name'] === 'Amount') $amount = $item['Value'];
            if ($item['Name'] === 'MpesaReceiptNumber') $mpesaReceiptNumber = $item['Value'];
            if ($item['Name'] === 'TransactionDate') $transactionDate = $item['Value'];
            if ($item['Name'] === 'PhoneNumber') $phoneNumber = $item['Value'];
        }

        // Find transaction by CheckoutRequestID
        $transaction = MpesaTransaction::where('checkout_request_id', $checkoutRequestId)->first();
        if (!$transaction) {
            return response()->json(['status' => 'failed', 'message' => 'Transaction not found'], 404);
        }

        // Update transaction fields
        $transaction->merchant_request_id = $merchantRequestId;
        $transaction->amount = $amount ?? $transaction->amount;
        $transaction->mpesa_code = $mpesaReceiptNumber ?? $transaction->mpesa_code;
        $transaction->phone_number = $phoneNumber ?? $transaction->phone_number;
        $transaction->transaction_date = $transactionDate ? \Carbon\Carbon::createFromFormat('YmdHis', $transactionDate) : $transaction->transaction_date;
        $transaction->raw_response = json_encode($data);
        if ($resultCode === 0 || $resultCode === '0') {
            $transaction->status = 'completed';
            // Create Payment record
            $payment = new Payment();
            $payment->company_id = $transaction->company_id;
            $payment->customer_id = $transaction->customer_id;
            $payment->transaction_id = $transaction->mpesa_code;
            $payment->amount_paid = $transaction->amount;
            $payment->payment_method = 'mpesa';
            $payment->status = 'completed';
            $payment->payment_date = $transaction->transaction_date;
            $payment->save();
            $transaction->payment_id = $payment->id;
        } else {
            $transaction->status = 'failed';
            // Dispatch STK Query job if failed
            \App\Jobs\MpesaStkQueryJob::dispatch($transaction->id)->delay(now()->addSeconds(10));
        }
        $transaction->save();

        return response()->json(['status' => 'success', 'message' => 'Transaction updated'], 200);
    }
}
