<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // The public account pages, keyed by what is being attacked: behind the host's proxy many
        // people can share one IP.
        $tooMany = fn () => response()->json(['status' => 'failed', 'message' => 'Too many attempts. Please wait a minute and try again.'], 429);
        RateLimiter::for('password-email', fn (Request $request) => Limit::perMinute(5)->by('reset|' . strtolower(trim((string) $request->input('email'))))->response($tooMany));
        RateLimiter::for('set-password', fn (Request $request) => Limit::perMinute(10)->by('set|' . $request->route('userId'))->response($tooMany));
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(10)->by('register|' . $request->ip())->response($tooMany));

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
