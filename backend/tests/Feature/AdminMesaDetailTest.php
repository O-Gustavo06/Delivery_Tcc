<?php

namespace Tests\Feature;

use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminMesaDetailTest extends TestCase
{
    use CriaDadosBasicos;

    public function test_detalhe_da_mesa_mostra_comanda_atual_com_quem_pediu_e_quanto(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 22.50]);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900008888',
            'nome' => 'Cliente Mesa Detalhe',
        ])->json();

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 2]],
        ])->assertStatus(201);

        [, $tokenAdmin] = $this->criarAdminComToken();

        $response = $this->getJson("/api/admin/mesas/{$mesa->id_mesa}", ['Authorization' => "Bearer $tokenAdmin"]);

        $response->assertOk()
            ->assertJsonPath('mesa.numero', $mesa->nr_mesa)
            ->assertJsonPath('comanda_atual.total', 45)
            ->assertJsonPath('comanda_atual.pedidos.0.cliente_nome', 'Cliente Mesa Detalhe')
            ->assertJsonPath('comanda_atual.pedidos.0.itens.0.nome', $produto->nm_produto);
    }

    public function test_mesa_sem_comanda_aberta_retorna_null_e_nao_erro(): void
    {
        $empresa = $this->criarEmpresa();
        $mesa = $this->criarMesa($empresa);
        [, $tokenAdmin] = $this->criarAdminComToken();

        $this->getJson("/api/admin/mesas/{$mesa->id_mesa}", ['Authorization' => "Bearer $tokenAdmin"])
            ->assertOk()
            ->assertJsonPath('comanda_atual', null)
            ->assertJsonPath('historico', []);
    }

    public function test_mesa_inexistente_retorna_404(): void
    {
        [, $tokenAdmin] = $this->criarAdminComToken();

        $this->getJson('/api/admin/mesas/999999', ['Authorization' => "Bearer $tokenAdmin"])
            ->assertStatus(404);
    }
}
