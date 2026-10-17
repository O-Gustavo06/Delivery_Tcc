<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class PedidoOnlineTest extends TestCase
{
    use CriaDadosBasicos;

    protected function setUp(): void
    {
        parent::setUp();

        // Por padrao, simula o Nominatim respondendo com sucesso - os testes que nao sao
        // sobre geocodificacao em si nao devem depender de rede de verdade.
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '-23.5614', 'lon' => '-46.6558'],
            ], 200),
        ]);
    }

    private function pedidoPayload(array $overrides = []): array
    {
        return array_merge([
            'nome' => 'Cliente Online',
            'telefone' => '11900007777',
            'tipo_entrega' => 'delivery',
            'cep' => '01310-100',
            'endereco' => 'Rua das Palmeiras, 200',
            'payment_method' => 'pix',
            'cpf_cnpj' => '12345678909',
            'items' => [],
        ], $overrides);
    }

    public function test_cardapio_publico_lista_produtos_reais(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Pizza Teste', 'vl_preco_base' => 45]);

        $response = $this->getJson('/api/pedir');

        $response->assertOk()->assertJsonPath('produtos.0.nome', 'Pizza Teste');
    }

    public function test_criar_pedido_online_usa_preco_do_catalogo_e_comeca_numeracao_do_1(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 30]);

        $response = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 2, 'price' => 0.01]],
        ]));

        $response->assertStatus(201)
            ->assertJsonPath('subtotal', 60)
            ->assertJsonPath('total', 68)
            ->assertJsonPath('delivery_number', 1)
            ->assertJsonPath('status', 'aguardando_confirmacao');

        $this->assertDatabaseHas('pedido', [
            'tipo_pedido' => 'DELIVERY',
            'canal_origem' => 'ONLINE',
            'status' => 'PENDENTE',
            'vl_total' => 60,
        ]);

        $idPedido = \App\Models\Pedido::where('vl_total', 60)->value('id_pedido');
        $this->assertDatabaseHas('pagamento', [
            'id_pedido' => $idPedido,
            'vl_total' => 68,
            'vl_final' => 68,
        ]);

        $this->assertDatabaseHas('entrega', [
            'id_pedido' => $idPedido,
            'latitude_destino' => -23.5614,
            'longitude_destino' => -46.6558,
        ]);
    }

    public function test_pedido_para_retirada_no_balcao_nao_exige_endereco_nem_gera_entrega(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 25]);

        $response = $this->postJson('/api/pedir', [
            'nome' => 'Cliente Retirada',
            'telefone' => '11900001111',
            'tipo_entrega' => 'retirada',
            'payment_method' => 'pix',
            'cpf_cnpj' => '12345678909',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('total', 25)
            ->assertJsonPath('delivery_number', null)
            ->assertJsonPath('tipo_entrega', 'retirada')
            ->assertJsonPath('status', 'aguardando_confirmacao');

        $idPedido = \App\Models\Pedido::where('vl_total', 25)->value('id_pedido');

        $this->assertDatabaseHas('pedido', [
            'id_pedido' => $idPedido,
            'tipo_pedido' => 'BALCAO',
            'canal_origem' => 'ONLINE',
            'vl_taxa_entrega' => 0,
            'nr_pedido_delivery' => null,
            'ds_observacao' => null,
        ]);

        $this->assertDatabaseMissing('entrega', ['id_pedido' => $idPedido]);

        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'nominatim.openstreetmap.org'));
    }

    public function test_loja_fechada_nao_deixa_criar_pedido_online(): void
    {
        $empresa = $this->criarEmpresa(['fl_aberto' => false]);
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 15]);

        $response = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]));

        $response->assertStatus(422);
        $this->assertDatabaseMissing('pedido', ['vl_total' => 15]);
    }

    public function test_busca_cliente_por_telefone_devolve_nome_de_quem_ja_pediu(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 10]);

        $this->postJson('/api/pedir', $this->pedidoPayload([
            'nome' => 'Fulano da Silva',
            'telefone' => '11988887777',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]))->assertStatus(201);

        $this->getJson('/api/pedir/cliente/11988887777')
            ->assertOk()
            ->assertJsonPath('nome', 'Fulano da Silva');
    }

    public function test_busca_cliente_por_telefone_desconhecido_retorna_404(): void
    {
        $this->getJson('/api/pedir/cliente/11900000000')->assertStatus(404);
    }

    public function test_geocodificacao_usa_rua_e_cidade_quando_disponiveis_nao_so_o_cep(): void
    {
        // CEP sozinho tem cobertura ruim no Nominatim pra cidades menores - rua+cidade
        // deve ser tentado primeiro (e nesse teste, o CEP nem teria como funcionar).
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);

        $this->postJson('/api/pedir', $this->pedidoPayload([
            'rua' => 'Rua Santa Cecilia',
            'cidade' => 'Marilia',
            'uf' => 'SP',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]))->assertStatus(201);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'nominatim.openstreetmap.org')
                && ($request['street'] ?? null) === 'Rua Santa Cecilia'
                && ($request['city'] ?? null) === 'Marilia';
        });
    }

    public function test_falha_na_geocodificacao_nao_impede_criar_o_pedido(): void
    {
        $this->partialMock(\App\Services\GeocodingService::class, function ($mock) {
            $mock->shouldReceive('coordenadasPorEndereco')->andReturn(null);
        });

        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 15]);

        $response = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]));

        $response->assertStatus(201);
        $this->assertDatabaseHas('entrega', [
            'id_pedido' => \App\Models\Pedido::where('vl_total', 15)->value('id_pedido'),
            'latitude_destino' => null,
            'longitude_destino' => null,
        ]);
    }

    public function test_cliente_com_mesmo_telefone_nao_duplica_cadastro(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 10]);

        $payload = $this->pedidoPayload(['items' => [['id_produto' => $produto->id_produto, 'qty' => 1]]]);

        $this->postJson('/api/pedir', $payload)->assertStatus(201);
        $this->postJson('/api/pedir', $payload)->assertStatus(201);

        $this->assertDatabaseCount('cliente', 1);
        $this->assertDatabaseHas('pedido', ['nr_pedido_delivery' => 1]);
        $this->assertDatabaseHas('pedido', ['nr_pedido_delivery' => 2]);
    }

    public function test_repetir_post_com_mesma_chave_retorna_o_mesmo_pedido(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $idempotencyKey = (string) \Illuminate\Support\Str::uuid();
        $payload = $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]);

        $primeiraResposta = $this->postJson('/api/pedir', $payload, [
            'Idempotency-Key' => $idempotencyKey,
        ])->assertCreated();
        $segundaResposta = $this->postJson('/api/pedir', $payload, [
            'Idempotency-Key' => $idempotencyKey,
        ])->assertOk();

        $segundaResposta->assertJsonPath('codigo_qr', $primeiraResposta->json('codigo_qr'));
        $this->assertSame(1, \App\Models\Pedido::where('idempotency_key', $idempotencyKey)->count());
        $this->assertSame(1, \App\Models\Pagamento::where('id_pedido', $primeiraResposta->json('number'))->count());
    }

    public function test_criacao_pix_persiste_cobranca_antes_do_qr_e_reutiliza_a_chave(): void
    {
        config([
            'services.asaas.api_key' => 'asaas-teste',
            'services.asaas.base_url' => 'https://api-sandbox.asaas.com/v3',
        ]);
        Http::fake([
            'api-sandbox.asaas.com/v3/customers' => Http::response(['id' => 'cus_teste_1'], 201),
            'api-sandbox.asaas.com/v3/payments' => Http::response(['id' => 'pay_teste_1', 'status' => 'PENDING'], 201),
            'api-sandbox.asaas.com/v3/payments/pay_teste_1/pixQrCode' => Http::response([
                'encodedImage' => 'imagem-teste',
                'payload' => 'pix-copia-e-cola',
                'expirationDate' => '2027-01-01 00:00:00',
            ]),
        ]);
        $this->partialMock(\App\Services\GeocodingService::class, function ($mock) {
            $mock->shouldReceive('coordenadasPorEndereco')->andReturn(null);
        });

        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);
        $idempotencyKey = (string) \Illuminate\Support\Str::uuid();
        $payload = $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]);

        $response = $this->postJson('/api/pedir', $payload, [
            'Idempotency-Key' => $idempotencyKey,
        ])->assertCreated()
            ->assertJsonPath('total', 28)
            ->assertJsonPath('payment.pix.payload', 'pix-copia-e-cola');

        $this->assertDatabaseHas('pagamento', [
            'id_pedido' => $response->json('number'),
            'vl_final' => 28,
        ]);
        $this->assertDatabaseHas('transacao_pagamento', [
            'provedor' => 'ASAAS',
            'nsu' => 'pay_teste_1',
            'status' => 'PENDENTE',
        ]);
        Http::assertSentCount(3);

        $this->postJson('/api/pedir', $payload, [
            'Idempotency-Key' => $idempotencyKey,
        ])->assertOk()
            ->assertJsonPath('codigo_qr', $response->json('codigo_qr'))
            ->assertJsonPath('payment.pix.payload', 'pix-copia-e-cola');
        Http::assertSentCount(3);
    }

    public function test_webhook_asaas_atualiza_pagamento_sem_avancar_pedido_e_ignora_evento_antigo(): void
    {
        config([
            'services.asaas.api_key' => null,
            'services.asaas.webhook_token' => 'webhook-teste',
        ]);

        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        $pedido = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]))->assertCreated();
        $idPedido = \App\Models\Pedido::where('codigo_qr', $pedido->json('codigo_qr'))->value('id_pedido');
        $pagamento = \App\Models\Pagamento::where('id_pedido', $idPedido)->firstOrFail();
        $webhook = [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => [
                'id' => 'pay_teste_123',
                'externalReference' => "pedido:{$idPedido}",
                'status' => 'CONFIRMED',
            ],
        ];

        $this->postJson('/api/asaas/webhook', $webhook, [
            'asaas-access-token' => 'webhook-teste',
        ])->assertOk();
        $this->postJson('/api/asaas/webhook', $webhook, [
            'asaas-access-token' => 'webhook-teste',
        ])->assertOk();

        $this->assertDatabaseHas('pagamento', [
            'id_pagamento' => $pagamento->id_pagamento,
            'status' => 'APROVADO',
        ]);
        $this->assertDatabaseHas('transacao_pagamento', [
            'id_pagamento' => $pagamento->id_pagamento,
            'provedor' => 'ASAAS',
            'nsu' => 'pay_teste_123',
            'status' => 'APROVADA',
        ]);
        $this->assertSame(1, \App\Models\TransacaoPagamento::where('provedor', 'ASAAS')
            ->where('nsu', 'pay_teste_123')
            ->count());
        $this->assertDatabaseHas('pedido', [
            'id_pedido' => $idPedido,
            'status' => 'PENDENTE',
        ]);

        $this->postJson('/api/asaas/webhook', [
            'event' => 'PAYMENT_OVERDUE',
            'payment' => $webhook['payment'],
        ], [
            'asaas-access-token' => 'webhook-teste',
        ])->assertOk();

        $this->assertDatabaseHas('pagamento', [
            'id_pagamento' => $pagamento->id_pagamento,
            'status' => 'APROVADO',
        ]);
        $this->assertDatabaseHas('transacao_pagamento', [
            'id_pagamento' => $pagamento->id_pagamento,
            'provedor' => 'ASAAS',
            'nsu' => 'pay_teste_123',
            'status' => 'APROVADA',
        ]);
    }

    public function test_admin_aceita_pedido_online_e_cliente_ve_status_atualizado(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);

        $pedido = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]))->json();

        [, $tokenAdmin] = $this->criarAdminComToken();
        $idPedido = \App\Models\Pedido::where('codigo_qr', $pedido['codigo_qr'])->value('id_pedido');

        // Aceitar = pula direto pra em_preparo, sem passar por enviado_cozinha.
        $this->patchJson("/api/admin/orders/{$idPedido}/status", ['status' => 'em_preparo'], ['Authorization' => "Bearer $tokenAdmin"])
            ->assertOk();

        $this->getJson("/api/pedir/status/{$pedido['codigo_qr']}")
            ->assertOk()
            ->assertJsonPath('status', 'em_preparo');
    }

    public function test_produto_desativado_nao_pode_ser_pedido_pelo_canal_online(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produtoInativo = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20, 'fl_ativo' => false]);

        $response = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produtoInativo->id_produto, 'qty' => 1]],
        ]));

        $response->assertStatus(422);
        $this->assertDatabaseMissing('pedido', ['id_empresa' => $empresa->id_empresa]);
        $this->assertDatabaseMissing('item_pedido', ['id_produto' => $produtoInativo->id_produto]);
    }

    public function test_admin_recusa_pedido_online_com_motivo_e_cliente_ve_o_motivo(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);

        $pedido = $this->postJson('/api/pedir', $this->pedidoPayload([
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ]))->json();

        [, $tokenAdmin] = $this->criarAdminComToken();
        $idPedido = \App\Models\Pedido::where('codigo_qr', $pedido['codigo_qr'])->value('id_pedido');

        $this->patchJson(
            "/api/admin/orders/{$idPedido}/status",
            ['status' => 'cancelado', 'motivo' => 'Fora da area de entrega'],
            ['Authorization' => "Bearer $tokenAdmin"],
        )->assertOk();

        $this->getJson("/api/pedir/status/{$pedido['codigo_qr']}")
            ->assertOk()
            ->assertJsonPath('status', 'recusado')
            ->assertJsonPath('motivo_cancelamento', 'Fora da area de entrega');
    }
}
