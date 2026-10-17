<?php

namespace Tests\Feature;

use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class MesaFlowTest extends TestCase
{
    use CriaDadosBasicos;

    public function test_cliente_novo_precisa_de_nome_na_primeira_vez(): void
    {
        $empresa = $this->criarEmpresa();
        $mesa = $this->criarMesa($empresa);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", ['telefone' => '11900001111'])
            ->assertStatus(422)
            ->assertJsonPath('novo_cliente', true);
    }

    public function test_cliente_novo_com_nome_abre_comanda_e_ocupa_a_mesa(): void
    {
        $empresa = $this->criarEmpresa();
        $mesa = $this->criarMesa($empresa, ['status_ocupacao' => 'LIVRE']);

        $response = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900001111',
            'nome' => 'Cliente Novo',
        ]);

        $response->assertOk()->assertJsonStructure(['cliente' => ['id', 'nome'], 'id_comanda']);
        $this->assertDatabaseHas('mesa', ['id_mesa' => $mesa->id_mesa, 'status_ocupacao' => 'OCUPADA']);
        $this->assertDatabaseHas('comanda', ['id_mesa' => $mesa->id_mesa, 'status' => 'ABERTA']);
    }

    public function test_cliente_recorrente_so_precisa_do_telefone(): void
    {
        $empresa = $this->criarEmpresa();
        $mesaA = $this->criarMesa($empresa);
        $mesaB = $this->criarMesa($empresa);

        $this->postJson("/api/mesa/{$mesaA->qr_code_token}/identificar", [
            'telefone' => '11900002222',
            'nome' => 'Cliente Recorrente',
        ])->assertOk();

        // Mesa diferente, mesmo telefone: nao deveria pedir nome de novo.
        $this->postJson("/api/mesa/{$mesaB->qr_code_token}/identificar", ['telefone' => '11900002222'])
            ->assertOk()
            ->assertJsonPath('cliente.nome', 'Cliente Recorrente');
    }

    public function test_preco_do_pedido_vem_sempre_do_catalogo_nunca_do_cliente(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 25.00]);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900003333',
            'nome' => 'Cliente Preco',
        ])->json();

        // Tenta mandar preco manipulado - o backend nao aceita preco no payload, so id_produto/qty.
        $response = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 2, 'price' => 0.01]],
        ]);

        $response->assertStatus(201)->assertJsonPath('total', 50);
    }

    public function test_pedido_da_mesa_vai_direto_pra_fila_da_cozinha_sem_precisar_de_atendente(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900007777',
            'nome' => 'Cliente Cozinha Direta',
        ])->json();

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(201);

        // CONFIRMADO = ja esta na fila que a tela da Cozinha mostra, sem precisar de
        // ninguem clicar "Enviar cozinha" (esse passo so existe pra pedido criado pelo admin).
        $this->assertDatabaseHas('pedido', [
            'id_mesa' => $mesa->id_mesa,
            'tipo_pedido' => 'MESA',
            'status' => 'CONFIRMADO',
        ]);
    }

    public function test_produto_desativado_nao_pode_ser_pedido_na_mesa(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produtoInativo = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20, 'fl_ativo' => false]);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900006666',
            'nome' => 'Cliente Produto Inativo',
        ])->json();

        $response = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produtoInativo->id_produto, 'qty' => 1]],
        ]);

        $response->assertStatus(201)->assertJsonPath('total', 0);
        $this->assertDatabaseMissing('item_pedido', ['id_produto' => $produtoInativo->id_produto]);
    }

    public function test_fluxo_completo_pedir_fechar_e_caixa_confirmar_libera_mesa(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 30.00]);
        $mesa = $this->criarMesa($empresa, ['status_ocupacao' => 'LIVRE']);

        $identificar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900004444',
            'nome' => 'Cliente Fluxo',
        ])->json();

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(201);

        $fechar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/fechar", ['forma_pagamento' => 'pix']);
        $fechar->assertOk()->assertJsonPath('status', 'AGUARDANDO_PAGAMENTO');

        [, $tokenAdmin] = $this->criarAdminComToken();
        $idComanda = $fechar->json('id_comanda');

        $pendentes = $this->getJson('/api/admin/comandas/pendentes', ['Authorization' => "Bearer $tokenAdmin"]);
        $pendentes->assertOk();
        $this->assertContains($idComanda, collect($pendentes->json())->pluck('id_comanda')->all());

        $this->postJson("/api/admin/comandas/{$idComanda}/confirmar-pagamento", [], ['Authorization' => "Bearer $tokenAdmin"])
            ->assertOk()
            ->assertJsonPath('status', 'PAGA');

        $this->assertDatabaseHas('mesa', ['id_mesa' => $mesa->id_mesa, 'status_ocupacao' => 'LIVRE']);
        $this->assertDatabaseHas('pagamento', ['id_pedido' => \App\Models\Pedido::where('id_comanda', $idComanda)->value('id_pedido'), 'status' => 'APROVADO']);
    }

    public function test_nao_da_pra_pedir_em_comanda_ja_fechada(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [
            'telefone' => '11900005555',
            'nome' => 'Cliente Comanda Fechada',
        ])->json();

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/fechar", ['forma_pagamento' => 'cartao']);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $identificar['cliente']['id'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(422);
    }

    public function test_ler_qr_da_mesa_ocupa_a_mesa_e_abre_comanda_uma_vez_so(): void
    {
        $empresa = $this->criarEmpresa();
        $mesa = $this->criarMesa($empresa, ['status_ocupacao' => 'LIVRE']);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/ocupar")
            ->assertOk()
            ->assertJsonPath('comanda.status', 'ABERTA')
            ->assertJsonPath('comanda.total', 0);

        // Segunda leitura (outra pessoa da mesa) reaproveita a mesma comanda.
        $this->postJson("/api/mesa/{$mesa->qr_code_token}/ocupar")->assertOk();

        $this->assertDatabaseHas('mesa', ['id_mesa' => $mesa->id_mesa, 'status_ocupacao' => 'OCUPADA']);
        $this->assertSame(1, \App\Models\Comanda::where('id_mesa', $mesa->id_mesa)->count());
    }

    public function test_pedido_pelo_qr_so_com_nome_soma_na_conta_agrupando_por_produto(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $burger = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 30.00]);
        $suco = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 8.50]);
        $mesa = $this->criarMesa($empresa);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/ocupar")->assertOk();

        $primeiro = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'nome' => 'Ana',
            'items' => [['id_produto' => $burger->id_produto, 'qty' => 2, 'note' => 'sem cebola']],
        ])->assertStatus(201)->json();

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => $primeiro['id_cliente'],
            'items' => [
                ['id_produto' => $burger->id_produto, 'qty' => 1],
                ['id_produto' => $suco->id_produto, 'qty' => 2],
            ],
        ])
            ->assertStatus(201)
            ->assertJsonPath('total', 107)
            ->assertJsonCount(2, 'consumo');

        $consumo = collect($this->getJson("/api/mesa/{$mesa->qr_code_token}")->json('comanda.consumo'))->keyBy('id_produto');
        $this->assertSame(3, $consumo[$burger->id_produto]['qty']);
        $this->assertEquals(90, $consumo[$burger->id_produto]['subtotal']);
        $this->assertSame(2, $consumo[$suco->id_produto]['qty']);
        $this->assertDatabaseHas('item_pedido', ['id_produto' => $burger->id_produto, 'nr_quantidade' => 2]);
    }

    public function test_novas_rodadas_entram_no_mesmo_pedido_da_mesa(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 10.00]);
        $mesa = $this->criarMesa($empresa);

        $primeira = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'nome' => 'Carla',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(201)->json();

        // Cozinha ja entregou a primeira rodada...
        \App\Models\Pedido::whereKey($primeira['id_pedido'])->update(['status' => 'PRONTO']);

        // ...e outra pessoa da mesa pede mais.
        $segunda = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'nome' => 'Diego',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 2]],
        ])->assertStatus(201)->json();

        $this->assertSame($primeira['id_pedido'], $segunda['id_pedido']);
        $this->assertSame(1, \App\Models\Pedido::where('id_mesa', $mesa->id_mesa)->count());

        $pedido = \App\Models\Pedido::find($primeira['id_pedido']);
        $this->assertEquals(30, $pedido->vl_total);
        $this->assertSame(1, $pedido->nr_acrescimos);
        $this->assertNotNull($pedido->dt_ultimo_acrescimo);
        // Tinha saido da cozinha: os itens novos fazem o pedido voltar pra fila.
        $this->assertSame('CONFIRMADO', $pedido->status);
        $this->assertSame('PRESENCIAL', $pedido->canal_origem);
        $this->assertEquals(30, \App\Models\Pagamento::where('id_pedido', $pedido->id_pedido)->value('vl_final'));
    }

    public function test_pedido_cancelado_sai_do_total_da_conta(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20.00]);
        $mesa = $this->criarMesa($empresa);

        $pedido = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'nome' => 'Bruno',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(201)->json();

        \App\Models\Pedido::whereKey($pedido['id_pedido'])->update(['status' => 'CANCELADO']);

        $this->getJson("/api/mesa/{$mesa->qr_code_token}")
            ->assertJsonPath('comanda.total', 0)
            ->assertJsonCount(0, 'comanda.consumo');
    }
}
