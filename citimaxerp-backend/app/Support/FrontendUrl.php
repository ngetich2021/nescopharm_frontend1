<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * The site an emailed link opens. A request's Origin can be set to anything (and CORS allows all
 * origins), so it is only used when it is one of our own sites; otherwise a reset link could be
 * sent pointing at someone else's. Other sites are listed in FRONTEND_URLS.
 */
class FrontendUrl
{
    public static function for(Request $request): string
    {
        $sites = collect([config('app.frontend_url'), ...config('app.frontend_urls', [])])
            ->map(fn ($url) => self::base($url))
            ->filter()
            ->unique()
            ->values();

        if (!app()->environment('local', 'testing')) {
            $sites = $sites->reject(fn ($url) => in_array(parse_url($url, PHP_URL_HOST), ['localhost', '127.0.0.1'], true))->values();
        }

        $origin = self::base($request->header('Origin') ?: $request->header('Referer'));

        return $origin && $sites->contains($origin) ? $origin : (string) $sites->first();
    }

    /** "https://site.example:3000/any/path" becomes "https://site.example:3000". */
    private static function base(?string $url): ?string
    {
        $parts = $url ? parse_url(trim($url)) : null;
        if (empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }

        return strtolower($parts['scheme']) . '://' . strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
    }
}
