<?php

namespace App\Support;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use PDOException;
use RuntimeException;
use Throwable;

/**
 * What the person sees when a payment can't be saved: always a plain message saying what happened
 * and what to do, never SQL or a stack message. The technical detail goes to the log, under the
 * reference quoted in the message when it is a fault on our side.
 *
 * Answers 422: the frontend's apiCall wraps a 500 in its own "Server error (500)" text.
 */
class PaymentFailure
{
    public const NOT_ALLOWED = "Your role isn't allowed to do this with payments. Ask your administrator for the invoice update permission.";

    public const VALIDATION_MESSAGES = [
        'amount.required' => 'Enter the amount received.',
        'amount.numeric' => 'The amount must be a number.',
        'amount.min' => 'The amount must be more than zero.',
        'amount_paid.required' => 'Enter the amount received.',
        'amount_paid.numeric' => 'The amount must be a number.',
        'amount_paid.min' => 'The amount must be more than zero.',
        'payment_method.required' => 'Choose how the customer paid.',
        'payment_method.in' => 'The payment method must be Cash, M-Pesa Paybill or Bank Transfer. Record a cheque from the cheque option.',
        'payment_date.date' => 'Enter a valid payment date.',
        'transaction_id.max' => 'The reference is too long: use 255 characters or fewer.',
        'allocations.*.invoice_id.required_with' => 'Each line of the split needs an invoice.',
        'allocations.*.invoice_id.uuid' => 'One of the invoices in the split is not valid. Reopen the form and try again.',
        'allocations.*.amount.required_with' => 'Each line of the split needs an amount.',
        'allocations.*.amount.numeric' => 'Each amount in the split must be a number.',
        'allocations.*.amount.min' => 'Each amount in the split must be more than zero.',
    ];

    /** @param string $what What failed, as the start of a sentence: "This payment", "This cheque". */
    public static function response(Throwable $e, string $what = 'This payment'): JsonResponse
    {
        return response()->json(['status' => 'failed', 'message' => self::message($e, $what)], 422);
    }

    public static function message(Throwable $e, string $what = 'This payment'): string
    {
        if ($e instanceof ModelNotFoundException) {
            return "{$what} was not saved: the customer or invoice it is for no longer exists. Refresh the page and check.";
        }

        if ($e instanceof QueryException || $e instanceof PDOException) {
            $state = (string) $e->getCode();
            if (in_array($state, ['40001', '40P01', '55P03'], true)) {
                return "{$what} was not saved because someone else was updating the same invoices at that moment. Nothing changed. Please try again.";
            }
            if (str_starts_with($state, '08')) {
                return "{$what} was not saved because the connection to the server dropped. Check the customer's account first, then try again if it isn't there.";
            }

            return self::systemFault($e, $what);
        }

        // Our own business rules: their messages are written for the person using the system.
        if ($e instanceof RuntimeException) {
            return $e->getMessage();
        }

        return self::systemFault($e, $what);
    }

    protected static function systemFault(Throwable $e, string $what): string
    {
        $reference = strtoupper(Str::random(8));
        Log::error('Payment failed', ['reference' => $reference, 'what' => $what, 'error' => $e->getMessage()]);

        return "{$what} was not saved because of a system problem, and nothing changed on the invoices. Please try again. If it keeps failing, give support this reference: {$reference}.";
    }
}
