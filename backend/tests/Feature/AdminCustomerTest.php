<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\User;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminCustomerTest extends TestCase
{
    use CriaDadosBasicos;

    private function headers(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => "Bearer {$token}"];
    }

    private function criarCliente(): Cliente
    {
        $usuario = $this->criarUsuario('CLIENTE');

        return Cliente::create([
            'id_usuario' => $usuario->id_usuario,
            'telefone' => '119' . random_int(10000000, 99999999),
            'cpf' => (string) random_int(10000000000, 99999999999),
        ]);
    }

    public function test_editar_cliente_atualiza_nome_telefone_e_cpf(): void
    {
        $cliente = $this->criarCliente();
        $telefone = '119' . random_int(10000000, 99999999);
        $cpf = (string) random_int(10000000000, 99999999999);

        $this->patchJson("/api/admin/customers/{$cliente->id_cliente}", [
            'nome' => 'Cliente Atualizado',
            'telefone' => $telefone,
            'cpf' => $cpf,
        ], $this->headers())
            ->assertOk()
            ->assertJsonPath('nome', 'Cliente Atualizado')
            ->assertJsonPath('telefone', $telefone)
            ->assertJsonPath('cpf', $cpf);

        $this->assertDatabaseHas('usuario', [
            'id_usuario' => $cliente->id_usuario,
            'nm_usuario' => 'Cliente Atualizado',
        ]);
        $this->assertDatabaseHas('cliente', [
            'id_cliente' => $cliente->id_cliente,
            'telefone' => $telefone,
            'cpf' => $cpf,
        ]);
    }

    public function test_excluir_cliente_sem_historico_remove_seu_cadastro_e_usuario(): void
    {
        $cliente = $this->criarCliente();

        $this->deleteJson("/api/admin/customers/{$cliente->id_cliente}", [], $this->headers())
            ->assertNoContent();

        $this->assertDatabaseMissing('cliente', ['id_cliente' => $cliente->id_cliente]);
        $this->assertDatabaseMissing('usuario', ['id_usuario' => $cliente->id_usuario]);
    }
}
