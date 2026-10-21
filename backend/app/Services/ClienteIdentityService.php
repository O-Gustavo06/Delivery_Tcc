<?php

namespace App\Services;

use App\Models\Cliente;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ClienteIdentityService
{
    public static function normalizarTelefone(?string $telefone): ?string
    {
        $digitos = preg_replace('/\D+/', '', $telefone ?? '');

        if ($digitos === '') {
            return null;
        }

        if (str_starts_with($digitos, '00')) {
            $digitos = substr($digitos, 2);
        }

        if (strlen($digitos) > 11 && str_starts_with($digitos, '55')) {
            $digitos = substr($digitos, 2);
        }

        $digitos = substr($digitos, -11);

        return strlen($digitos) >= 10 ? '55' . $digitos : null;
    }

    public function buscarPorTelefone(?string $telefone): ?Cliente
    {
        $normalizado = self::normalizarTelefone($telefone);
        if (!$normalizado) {
            return null;
        }

        return Cliente::with('usuario')
            ->where('telefone_normalizado', $normalizado)
            ->whereNull('id_cliente_principal')
            ->first();
    }

    public function resolverPorId(int $id): ?Cliente
    {
        $cliente = Cliente::with('usuario')->find($id);
        if (!$cliente || !$cliente->id_cliente_principal) {
            return $cliente;
        }

        return Cliente::with('usuario')->find($cliente->id_cliente_principal);
    }

    public function buscarOuCriar(string $nome, ?string $telefone, ?string $cpf = null): Cliente
    {
        $normalizado = self::normalizarTelefone($telefone);
        if (trim($telefone ?? '') !== '' && !$normalizado) {
            throw ValidationException::withMessages([
                'telefone' => ['Informe um telefone brasileiro válido com DDD.'],
            ]);
        }

        $existente = $this->buscarPorTelefone($normalizado);
        if ($existente) {
            return $existente;
        }

        try {
            return DB::transaction(function () use ($nome, $telefone, $cpf, $normalizado) {
                $existente = $this->buscarPorTelefone($normalizado);
                if ($existente) {
                    return $existente;
                }

                $usuario = User::create([
                    'nm_usuario' => trim($nome),
                    'email' => 'cliente+' . Str::uuid() . '@cliente.local',
                    'senha_hash' => bcrypt(Str::random(40)),
                    'perfil' => 'CLIENTE',
                    'fl_ativo' => true,
                ]);

                $cliente = Cliente::create([
                    'id_usuario' => $usuario->id_usuario,
                    'telefone' => $telefone,
                    'telefone_normalizado' => $normalizado,
                    'cpf' => $cpf,
                ])->load('usuario');

                if ($normalizado) {
                    DB::table('whatsapp_mensagem')
                        ->where('telefone', $normalizado)
                        ->whereNull('id_cliente')
                        ->update(['id_cliente' => $cliente->id_cliente]);
                }

                return $cliente;
            });
        } catch (QueryException $exception) {
            $existente = $this->buscarPorTelefone($normalizado);
            if ($existente) {
                return $existente;
            }

            throw $exception;
        }
    }
}
