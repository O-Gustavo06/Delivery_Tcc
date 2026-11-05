<?php

namespace Tests\Feature;

use App\Jobs\EnviarPesquisaPosVenda;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class MesaFlowTest extends TestCase
{
    use CriaDadosBasicos;

    private function identificarMesa(\App\Models\Mesa $mesa, string $nome): array
    {
        return $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", ['nome' => $nome])
            ->assertOk()
            ->json();
    }

    public function test_cliente_novo_precisa_de_nome_na_primeira_vez(): void
    {
        $empresa = $this->criarEmpresa();
        $mesa = $this->criarMesa($empresa);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('nome');
    }

    public function test_cliente_novo_com_nome_abre_comanda_e_ocupa_a_mesa(): void
    {
        $empresa = $this->criarEmpresa();
        $mesa = $this->criarMesa($empresa, ['status_ocupacao' => 'LIVRE']);

        $response = $this->postJson("/api/mesa/{$mesa->qr_code_token}/identificar", ['nome' => 'Cliente Novo']);

        $response->assertOk()
            ->assertJsonStructure(['cliente' => ['nome'], 'session_token', 'id_comanda'])
            ->assertJsonMissingPath('cliente.id');
        $this->assertDatabaseHas('mesa', ['id_mesa' => $mesa->id_mesa, 'status_ocupacao' => 'OCUPADA']);
        $this->assertDatabaseHas('comanda', ['id_mesa' => $mesa->id_mesa, 'status' => 'ABERTA']);
    }

    public function test_identificacao_publica_nao_revela_ou_reutiliza_conta_existente_por_telefone(): void
    {
        $empresa = $this->criarEmpresa();
        $mesaA = $this->criarMesa($empresa);
        app(\App\Services\ClienteIdentityService::class)->buscarOuCriar('Conta Privada', '11900002222');

        $response = $this->postJson("/api/mesa/{$mesaA->qr_code_token}/identificar", ['nome' => 'Visitante'])
            ->assertOk()
            ->assertJsonPath('cliente.nome', 'Visitante')
            ->assertJsonMissingPath('cliente.id');

        $this->assertStringNotContainsString('Conta Privada', $response->getContent());
    }

    public function test_preco_do_pedido_vem_sempre_do_catalogo_nunca_do_cliente(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 25.00]);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->identificarMesa($mesa, 'Cliente Preco');

        // Um ID arbitrário sem sessão vinculada não autoriza pedido.
        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'id_cliente' => 999999,
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 2, 'price' => 0.01]],
        ])->assertStatus(422);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $identificar['session_token'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 2, 'price' => 0.01]],
        ])->assertStatus(201)->assertJsonPath('total', 50);
    }

    public function test_sessao_de_mesa_nao_pode_ser_reutilizada_em_outra_mesa(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $mesaA = $this->criarMesa($empresa);
        $mesaB = $this->criarMesa($empresa);
        $sessao = $this->identificarMesa($mesaA, 'Visitante');

        $this->postJson("/api/mesa/{$mesaB->qr_code_token}/pedidos", [
            'session_token' => $sessao['session_token'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertUnauthorized();
    }

    public function test_sessao_expirada_da_mesa_nao_autoriza_pedido(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $mesa = $this->criarMesa($empresa);
        $cliente = app(\App\Services\ClienteIdentityService::class)->buscarOuCriar('Visitante', null);
        $sessaoExpirada = \Illuminate\Support\Facades\Crypt::encrypt([
            'cliente_id' => $cliente->id_cliente,
            'mesa_id' => $mesa->id_mesa,
            'expires_at' => now()->subSecond()->timestamp,
        ]);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $sessaoExpirada,
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertUnauthorized();
    }

    public function test_pedido_da_mesa_vai_direto_pra_fila_da_cozinha_sem_precisar_de_atendente(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->identificarMesa($mesa, 'Cliente Cozinha Direta');

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $identificar['session_token'],
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

        $identificar = $this->identificarMesa($mesa, 'Cliente Produto Inativo');

        $response = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $identificar['session_token'],
            'items' => [['id_produto' => $produtoInativo->id_produto, 'qty' => 1]],
        ]);

        $response->assertStatus(201)->assertJsonPath('total', 0);
        $this->assertDatabaseMissing('item_pedido', ['id_produto' => $produtoInativo->id_produto]);
    }

    public function test_fluxo_completo_pedir_fechar_e_caixa_confirmar_libera_mesa(): void
    {
        Queue::fake();
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 30.00]);
        $mesa = $this->criarMesa($empresa, ['status_ocupacao' => 'LIVRE']);

        $identificar = $this->identificarMesa($mesa, 'Cliente Fluxo');

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $identificar['session_token'],
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
        $this->assertDatabaseHas('pos_venda', [
            'id_comanda' => $idComanda,
            'status' => 'AGENDADA',
        ]);
        Queue::assertPushedOn('whatsapp', EnviarPesquisaPosVenda::class);
        $this->assertCount(1, Queue::pushed(EnviarPesquisaPosVenda::class));
    }

    public function test_nao_da_pra_pedir_em_comanda_ja_fechada(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $mesa = $this->criarMesa($empresa);

        $identificar = $this->identificarMesa($mesa, 'Cliente Comanda Fechada');

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $identificar['session_token'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/fechar", ['forma_pagamento' => 'cartao']);

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $identificar['session_token'],
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

        $sessao = $this->identificarMesa($mesa, 'Ana');
        $primeiro = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $sessao['session_token'],
            'items' => [['id_produto' => $burger->id_produto, 'qty' => 2, 'note' => 'sem cebola']],
        ])->assertStatus(201)->json();

        $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $sessao['session_token'],
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
        $sessaoCarla = $this->identificarMesa($mesa, 'Carla');

        $primeira = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $sessaoCarla['session_token'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(201)->json();

        // Cozinha ja entregou a primeira rodada...
        \App\Models\Pedido::whereKey($primeira['id_pedido'])->update(['status' => 'PRONTO']);

        // ...e outra pessoa da mesa pede mais.
        $sessaoDiego = $this->identificarMesa($mesa, 'Diego');
        $segunda = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $sessaoDiego['session_token'],
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
        $sessao = $this->identificarMesa($mesa, 'Bruno');

        $pedido = $this->postJson("/api/mesa/{$mesa->qr_code_token}/pedidos", [
            'session_token' => $sessao['session_token'],
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertStatus(201)->json();

        \App\Models\Pedido::whereKey($pedido['id_pedido'])->update(['status' => 'CANCELADO']);

        $this->getJson("/api/mesa/{$mesa->qr_code_token}")
            ->assertJsonPath('comanda.total', 0)
            ->assertJsonCount(0, 'comanda.consumo');
    }
}
