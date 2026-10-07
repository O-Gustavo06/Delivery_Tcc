<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Entregador;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserController extends Controller
{
    private const PERFIS = ['ADMIN', 'GERENTE', 'ENTREGADOR', 'ATENDENTE'];

    /** Quanto tempo o codigo de pareamento fica valido pro entregador escanear. */
    private const PAREAMENTO_VALIDADE_HORAS = 24;

    public function index(): JsonResponse
    {
        $users = User::whereIn('perfil', self::PERFIS)
            ->with('entregador')
            ->paginate(20);

        return response()->json([
            'data' => $users->map(fn ($u) => $this->toPublic($u)),
            'meta' => [
                'total'        => $users->total(),
                'per_page'     => $users->perPage(),
                'current_page' => $users->currentPage(),
                'last_page'    => $users->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $perfil = strtoupper((string) $request->input('role', ''));

        // Entregador nao se cadastra com email/senha: o painel pede so nome + telefone,
        // e a identidade e confirmada depois via QR (ver parear() no AuthController).
        if ($perfil === 'ENTREGADOR') {
            return $this->storeEntregador($request);
        }

        $data = $request->validate([
            'name'      => ['required', 'string', 'max:150'],
            'email'     => ['required', 'email', 'max:150', 'unique:usuario,email'],
            'password'  => ['required', 'string', 'min:8'],
            'role'      => ['required', 'string', 'in:ADMIN,GERENTE,ATENDENTE,admin,gerente,atendente'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user = User::create([
            'nm_usuario' => $data['name'],
            'email'      => $data['email'],
            'senha_hash' => Hash::make($data['password']),
            'perfil'     => strtoupper($data['role']),
            'fl_ativo'   => $data['is_active'] ?? true,
        ]);

        return response()->json($this->toPublic($user), 201);
    }

    private function storeEntregador(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => ['required', 'string', 'max:150'],
            'telefone'  => ['required', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'nm_usuario' => $data['name'],
                'email'      => $this->emailSintetico($data['name']),
                // Senha aleatoria que ninguem usa pra logar: o entregador entra so pelo QR.
                'senha_hash' => Hash::make(Str::random(40)),
                'perfil'     => 'ENTREGADOR',
                'fl_ativo'   => $data['is_active'] ?? true,
            ]);

            Entregador::create([
                'id_usuario'                  => $user->id_usuario,
                'telefone'                    => $data['telefone'],
                'fl_online'                   => false,
                'codigo_pareamento'           => $this->gerarCodigo(),
                'codigo_pareamento_expira_em' => now()->addHours(self::PAREAMENTO_VALIDADE_HORAS),
            ]);

            return $user->load('entregador');
        });

        return response()->json($this->toPublic($user), 201);
    }

    public function update(Request $request, string $userId): JsonResponse
    {
        $user = User::find((int) $userId);

        if (!$user) {
            return response()->json(['message' => 'Usuario nao encontrado.'], 404);
        }

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:150'],
            'email'     => ['sometimes', 'email', 'max:150', 'unique:usuario,email,' . $user->id_usuario . ',id_usuario'],
            'password'  => ['sometimes', 'string', 'min:8'],
            'is_active' => ['sometimes', 'boolean'],
            'telefone'  => ['sometimes', 'string', 'max:20'],
        ]);

        $mapped = [];
        if (isset($data['name']))      $mapped['nm_usuario'] = $data['name'];
        if (isset($data['email']))     $mapped['email']      = $data['email'];
        if (isset($data['is_active'])) $mapped['fl_ativo']   = $data['is_active'];
        if (isset($data['password'])) {
            $mapped['senha_hash'] = Hash::make($data['password']);
        }

        $user->update($mapped);

        if (isset($data['telefone']) && $user->perfil === 'ENTREGADOR') {
            $user->entregador?->update(['telefone' => $data['telefone']]);
        }

        return response()->json($this->toPublic($user->fresh('entregador')));
    }

    /**
     * POST /admin/users/{userId}/gerar-codigo-pareamento
     * Gera um novo QR de pareamento (ex: entregador trocou de aparelho, ou o anterior expirou).
     */
    public function gerarCodigoPareamento(string $userId): JsonResponse
    {
        $user = User::with('entregador')->find((int) $userId);

        if (!$user || $user->perfil !== 'ENTREGADOR' || !$user->entregador) {
            return response()->json(['message' => 'Entregador nao encontrado.'], 404);
        }

        $user->entregador->update([
            'codigo_pareamento'           => $this->gerarCodigo(),
            'codigo_pareamento_expira_em' => now()->addHours(self::PAREAMENTO_VALIDADE_HORAS),
        ]);

        return response()->json($this->toPublic($user->fresh('entregador')));
    }

    public function destroy(string $userId): JsonResponse
    {
        $user = User::find((int) $userId);

        if (!$user) {
            return response()->json(['message' => 'Usuario nao encontrado.'], 404);
        }

        try {
            $user->delete();
        } catch (QueryException $e) {
            // Erro 1451 do MySQL/MariaDB: existe pedido/entrega/etc. vinculado (via cliente ou
            // entregador) que impede o delete em cascata. Devolve mensagem legivel em vez do SQL cru.
            if ((int) $e->getCode() === 23000 || str_contains($e->getMessage(), '1451')) {
                return response()->json([
                    'message' => 'Nao e possivel excluir este usuario: existem pedidos ou entregas vinculados a ele. Desative o usuario em vez de excluir.',
                ], 409);
            }

            throw $e;
        }

        return response()->json(null, 204);
    }

    private function emailSintetico(string $name): string
    {
        $slug = strtolower(preg_replace('/\s+/', '.', trim($name)));

        return $slug . '+' . now()->timestamp . '@entregador.local';
    }

    private function gerarCodigo(): string
    {
        return strtoupper(Str::random(8));
    }

    private function toPublic(User $user): array
    {
        $entregador = $user->entregador;

        return [
            'id'        => $user->id_usuario,
            'name'      => $user->nm_usuario,
            'email'     => $user->email,
            'role'      => $user->perfil,
            'is_active' => (bool) $user->fl_ativo,
            'telefone'  => $entregador?->telefone,
            'pairing_code' => $entregador && $entregador->codigo_pareamento_expira_em?->isFuture()
                ? $entregador->codigo_pareamento
                : null,
            'pairing_expires_at' => $entregador?->codigo_pareamento_expira_em?->toIso8601String(),
            'pareado' => $entregador ? is_null($entregador->codigo_pareamento) : null,
        ];
    }
}
