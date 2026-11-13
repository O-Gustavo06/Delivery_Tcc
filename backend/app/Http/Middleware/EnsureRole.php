<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        $userPerfil = strtolower($user?->perfil ?? '');

        if (!$user || !in_array($userPerfil, array_map('strtolower', $roles), true)) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return $next($request);
    }
}

