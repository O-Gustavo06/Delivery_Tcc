<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Nao autenticado.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);

        if (!$accessToken || !($accessToken->tokenable instanceof User)) {
            return response()->json(['message' => 'Token invalido.'], 401);
        }

        $user = $accessToken->tokenable;
        $expirationMinutes = (int) config('sanctum.expiration', 1440);
        $expired = ($accessToken->expires_at?->isPast() ?? false)
            || ($expirationMinutes > 0
                && $accessToken->created_at?->lt(now()->subMinutes($expirationMinutes)))
            || (strtoupper($user->perfil) === 'ADMIN'
                && ($accessToken->last_used_at ?? $accessToken->created_at)->lte(now()->subHour()));

        if (!$user->fl_ativo || $expired) {
            $accessToken->delete();

            return response()->json(['message' => 'Token invalido ou expirado.'], 401);
        }

        $user->withAccessToken($accessToken);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
