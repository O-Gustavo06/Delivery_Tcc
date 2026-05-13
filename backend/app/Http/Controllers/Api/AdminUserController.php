<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\InMemoryUserRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminUserController extends Controller
{
    private const ROLES = ['admin', 'atendente', 'motoboy', 'cliente'];

    public function __construct(private readonly InMemoryUserRepository $users)
    {
    }

    public function index(): JsonResponse
    {
        $page = (int) request()->query('page', 1);
        $payload = $this->users->paginate(20, $page);
        $payload['data'] = $this->users->toPublicList($payload['data']);

        return response()->json($payload);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (!in_array($data['role'], self::ROLES, true)) {
            return response()->json([
                'message' => 'Role invalida.',
                'errors' => ['role' => ['Role invalida.']],
            ], 422);
        }

        if ($this->users->findByEmail($data['email'])) {
            return response()->json([
                'message' => 'Email ja cadastrado.',
                'errors' => ['email' => ['Email ja cadastrado.']],
            ], 422);
        }

        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = $data['is_active'] ?? true;

        $user = $this->users->create($data);

        return response()->json($this->users->toPublic($user), 201);
    }

    public function update(Request $request, string $userId): JsonResponse
    {
        $userId = (int) $userId;
        $existing = $this->users->findById($userId);

        if (!$existing) {
            return response()->json(['message' => 'Usuario nao encontrado.'], 404);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255'],
            'password' => ['sometimes', 'string', 'min:8'],
            'role' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('role', $data) && !in_array($data['role'], self::ROLES, true)) {
            return response()->json([
                'message' => 'Role invalida.',
                'errors' => ['role' => ['Role invalida.']],
            ], 422);
        }

        if (array_key_exists('email', $data)) {
            $emailOwner = $this->users->findByEmail($data['email']);
            if ($emailOwner && $emailOwner['id'] !== $userId) {
                return response()->json([
                    'message' => 'Email ja cadastrado.',
                    'errors' => ['email' => ['Email ja cadastrado.']],
                ], 422);
            }
        }

        if (array_key_exists('password', $data)) {
            $data['password'] = Hash::make($data['password']);
        }

        $user = $this->users->update($userId, $data);

        return response()->json($this->users->toPublic($user));
    }

    public function destroy(string $userId): JsonResponse
    {
        $userId = (int) $userId;

        if (!$this->users->delete($userId)) {
            return response()->json(['message' => 'Usuario nao encontrado.'], 404);
        }

        return response()->json(null, 204);
    }
}
