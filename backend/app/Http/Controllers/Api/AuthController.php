<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\InMemoryUserRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(private readonly InMemoryUserRepository $users)
    {
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = $this->users->findByEmail($credentials['email']);

        if (!$user || !Hash::check($credentials['password'], $user['password'])) {
            return response()->json(['message' => 'Credenciais invalidas.'], 401);
        }

        if (!$user['is_active']) {
            return response()->json(['message' => 'Usuario inativo.'], 403);
        }

        $token = $this->users->makeToken($user['id']);

        return response()->json([
            'token' => $token,
            'user' => $this->users->toPublic($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json($user ? $this->users->toPublic($user) : null);
    }
}
