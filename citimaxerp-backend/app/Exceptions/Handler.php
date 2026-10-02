<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->expectsJson() || str_starts_with($request->path(), 'api/')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Please log in to access this resource.',
            ], 401);
        }

        return parent::unauthenticated($request, $exception);
    }
}