<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Entregador;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->senha_hash)) {
            return response()->json(['message' => 'Credenciais invalidas.'], 401);
        }

        if (!$user->fl_ativo) {
            return response()->json(['message' => 'Usuario inativo.'], 403);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $this->toPublic($user),
        ]);
    }

    /**
     * POST /auth/parear
     * "Login" do entregador: em vez de email/senha, ele bipa o QR que o admin mostrou na tela
     * (ou digita o codigo) na hora do cadastro. Confirma que o aparelho e realmente dele.
     */
    public function parear(Request $request): JsonResponse
    {
        $data = $request->validate([
            'codigo' => ['required', 'string'],
        ]);

        $entregador = Entregador::with('usuario')
            ->where('codigo_pareamento', strtoupper(trim($data['codigo'])))
            ->first();

        if (!$entregador || !$entregador->codigo_pareamento_expira_em?->isFuture()) {
            return response()->json(['message' => 'Codigo invalido ou expirado. Peca um novo QR ao administrador.'], 422);
        }

        $user = $entregador->usuario;

        if (!$user->fl_ativo) {
            return response()->json(['message' => 'Usuario inativo.'], 403);
        }

        // Uso unico: depois de parear, o codigo nao serve mais (o admin gera outro se precisar
        // parear um aparelho novo).
        $entregador->update([
            'codigo_pareamento'           => null,
            'codigo_pareamento_expira_em' => null,
        ]);

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $this->toPublic($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json($user ? $this->toPublic($user) : null);
    }

    private function toPublic(User $user): array
    {
        return [
            'id'        => $user->id_usuario,
            'name'      => $user->nm_usuario,
            'email'     => $user->email,
            'role'      => $user->perfil,
            'is_active' => (bool) $user->fl_ativo,
        ];
    }
}

