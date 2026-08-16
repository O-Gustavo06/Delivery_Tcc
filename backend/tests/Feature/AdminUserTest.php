<?php

namespace Tests\Feature;

use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminUserTest extends TestCase
{
    use CriaDadosBasicos;

    private function headers(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => "Bearer $token"];
    }

    public function test_criar_entregador_so_com_nome_e_telefone_gera_codigo_de_pareamento(): void
    {
        $response = $this->postJson('/api/admin/users/create', [
            'name' => 'Gabriel Entregador',
            'telefone' => '11999990000',
            'role' => 'ENTREGADOR',
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('role', 'ENTREGADOR')
            ->assertJsonPath('telefone', '11999990000')
            ->assertJsonPath('pareado', false)
            ->assertJsonPath('pairing_code', fn ($code) => !empty($code) && strlen($code) === 8);

        $this->assertDatabaseHas('entregador', ['telefone' => '11999990000', 'cpf' => null]);
    }

    public function test_criar_entregador_sem_telefone_falha(): void
    {
        $this->postJson('/api/admin/users/create', [
            'name' => 'Sem Telefone',
            'role' => 'ENTREGADOR',
        ], $this->headers())->assertStatus(422);
    }

    public function test_criar_admin_ainda_exige_email_e_senha(): void
    {
        $this->postJson('/api/admin/users/create', [
            'name' => 'Novo Gerente',
            'role' => 'GERENTE',
        ], $this->headers())->assertStatus(422);

        $this->postJson('/api/admin/users/create', [
            'name' => 'Novo Gerente',
            'email' => 'gerente@teste.local',
            'password' => 'senha12345',
            'role' => 'GERENTE',
        ], $this->headers())->assertStatus(201);
    }

    public function test_entregador_criado_consegue_parear_e_usar_o_app_do_motoboy(): void
    {
        $criado = $this->postJson('/api/admin/users/create', [
            'name' => 'Gabriel Entregador',
            'telefone' => '11999990000',
            'role' => 'ENTREGADOR',
        ], $this->headers())->json();

        $pareado = $this->postJson('/api/auth/parear', ['codigo' => $criado['pairing_code']]);
        $pareado->assertOk();

        $token = $pareado->json('token');

        // Antes da correcao, Entregador::create() quebrava por timestamps mal configurados
        // e a linha em `entregador` nem chegava a existir - isso confirma que existe de verdade.
        $this->getJson('/api/motoboy/rotas/ativa', ['Authorization' => "Bearer $token"])
            ->assertStatus(404); // "nenhuma rota ativa", nao 403 (confirma que e reconhecido como entregador)
    }

    public function test_apagar_usuario_com_pedidos_vinculados_retorna_erro_amigavel(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);

        $order = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Balcao',
            'items' => [['name' => $produto->nm_produto, 'qty' => 1, 'price' => 20]],
        ], $this->headers())->json();

        $clienteUsuarioId = \App\Models\Pedido::find($order['id'])->cliente->id_usuario;

        $response = $this->deleteJson("/api/admin/users/{$clienteUsuarioId}", [], $this->headers());

        $response->assertStatus(409);
    }

    public function test_apagar_usuario_sem_vinculo_funciona(): void
    {
        $usuario = $this->criarUsuario('ATENDENTE');

        $this->deleteJson("/api/admin/users/{$usuario->id_usuario}", [], $this->headers())
            ->assertStatus(204);

        $this->assertDatabaseMissing('usuario', ['id_usuario' => $usuario->id_usuario]);
    }
}
