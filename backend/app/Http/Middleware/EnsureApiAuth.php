<?php

namespace App\Http\Middleware;

use App\Support\InMemoryUserRepository;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiAuth
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Nao autenticado.'], 401);
        }

        $users = new InMemoryUserRepository();
        $user = $users->findByToken($token);

        if (!$user) {
            return response()->json(['message' => 'Token invalido.'], 401);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
