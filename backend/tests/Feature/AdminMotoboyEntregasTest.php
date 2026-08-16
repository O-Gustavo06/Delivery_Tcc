<?php

namespace Tests\Feature;

use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminMotoboyEntregasTest extends TestCase
{
    use CriaDadosBasicos;

    public function test_admin_ve_o_historico_de_entregas_de_um_entregador_com_rua_valor_e_pagamento(): void
    {
        $empresa = $this->criarEmpresa();
        $this->criarCategoria($empresa);
        [, $tokenAdmin] = $this->criarAdminComToken();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'customer_name' => 'Cliente Rota Admin',
            'address' => 'Rua das Acacias, 321',
            'payment_method' => 'dinheiro',
            'items' => [['name' => 'Suco', 'qty' => 1, 'price' => 12]],
        ], ['Authorization' => "Bearer $tokenAdmin"])->json();

        $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);

        $response = $this->getJson(
            "/api/admin/motoboys/{$entregador->id_entregador}/entregas",
            ['Authorization' => "Bearer $tokenAdmin"],
        );

        $response->assertOk()
            ->assertJsonPath('entregador.nome', $entregador->usuario->nm_usuario)
            ->assertJsonPath('entregas.0.endereco', 'Rua das Acacias, 321')
            ->assertJsonPath('entregas.0.cliente_nome', 'Cliente Rota Admin')
            ->assertJsonPath('entregas.0.valor', 12)
            ->assertJsonPath('entregas.0.forma_pagamento', 'DINHEIRO');
    }

    public function test_entregador_inexistente_retorna_404(): void
    {
        [, $tokenAdmin] = $this->criarAdminComToken();

        $this->getJson('/api/admin/motoboys/999999/entregas', ['Authorization' => "Bearer $tokenAdmin"])
            ->assertStatus(404);
    }
}
