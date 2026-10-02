<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticateUserOrCustomer
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        if (Auth::guard('api')->check() || Auth::guard('customer')->check()) {
            return $next($request);
        }

        return response()->json([
            'status' => 'failed',
            'message' => 'Please log in to continue.'], 401);
    }
}