<?php

namespace Tests\Feature;

use App\Models\Empresa;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminEstoqueTest extends TestCase
{
    use CriaDadosBasicos;

    private function headers(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => "Bearer $token"];
    }

    public function test_registrar_compra_aumenta_estoque_do_ingrediente(): void
    {
        $empresa = $this->criarEmpresa();
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 0]);

        $response = $this->postJson('/api/admin/compras', [
            'nm_fornecedor' => 'Fornecedor Teste',
            'dt_compra' => now()->toDateString(),
            'itens' => [
                ['id_ingrediente' => $ingrediente->id_ingrediente, 'qtde' => 10, 'vl_unitario' => 5],
            ],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('total', 50);

        $this->assertDatabaseHas('estoque_movimento', [
            'id_ingrediente' => $ingrediente->id_ingrediente,
            'tipo' => 'ENTRADA',
            'qtde' => 10,
        ]);

        $this->assertEquals(10, (float) $ingrediente->fresh()->qtd_atual);
    }

    public function test_confirmar_pedido_baixa_estoque_conforme_receita(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Com Receita']);
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 100]);
        $this->criarReceita($produto, $ingrediente, ['qtde' => 2]);

        $orderResponse = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Receita',
            'items' => [['name' => 'Produto Com Receita', 'qty' => 3, 'price' => 20]],
        ], $this->headers());
        $orderResponse->assertStatus(201);
        $orderId = $orderResponse->json('id');

        $statusResponse = $this->patchJson("/api/admin/orders/{$orderId}/status", [
            'status' => 'enviado_cozinha',
        ], $this->headers());
        $statusResponse->assertStatus(200);

        // 100 - (2 por unidade x 3 unidades) = 94
        $this->assertEquals(94, (float) $ingrediente->fresh()->qtd_atual);
        $this->assertDatabaseHas('estoque_movimento', [
            'id_ingrediente' => $ingrediente->id_ingrediente,
            'tipo' => 'SAIDA',
            'qtde' => 6,
            'ds_motivo' => "Pedido #{$orderId}",
        ]);
    }

    public function test_confirmar_pedido_duas_vezes_nao_duplica_baixa(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Com Receita 2']);
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 100]);
        $this->criarReceita($produto, $ingrediente, ['qtde' => 2]);

        $orderResponse = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Receita 2',
            'items' => [['name' => 'Produto Com Receita 2', 'qty' => 3, 'price' => 20]],
        ], $this->headers());
        $orderId = $orderResponse->json('id');

        $this->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'enviado_cozinha'], $this->headers())
            ->assertStatus(200);
        // Manda pra cozinha de novo (ja esta CONFIRMADO) - nao deve baixar de novo.
        $this->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'enviado_cozinha'], $this->headers())
            ->assertStatus(200);

        $this->assertEquals(94, (float) $ingrediente->fresh()->qtd_atual);
        $this->assertDatabaseCount('estoque_movimento', 1);
    }

    public function test_cancelar_pedido_confirmado_repoe_estoque(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Com Receita 3']);
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 100]);
        $this->criarReceita($produto, $ingrediente, ['qtde' => 2]);

        $orderResponse = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Receita 3',
            'items' => [['name' => 'Produto Com Receita 3', 'qty' => 3, 'price' => 20]],
        ], $this->headers());
        $orderId = $orderResponse->json('id');

        $this->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'enviado_cozinha'], $this->headers())
            ->assertStatus(200);
        $this->assertEquals(94, (float) $ingrediente->fresh()->qtd_atual);

        $this->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'cancelado'], $this->headers())
            ->assertStatus(200);

        $this->assertEquals(100, (float) $ingrediente->fresh()->qtd_atual);
        $this->assertDatabaseHas('estoque_movimento', [
            'id_ingrediente' => $ingrediente->id_ingrediente,
            'tipo' => 'ENTRADA',
            'qtde' => 6,
            'ds_motivo' => "Cancelamento pedido #{$orderId}",
        ]);
    }

    public function test_cancelar_pedido_ainda_pendente_nao_mexe_no_estoque(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Sem Baixa']);
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 100]);
        $this->criarReceita($produto, $ingrediente, ['qtde' => 2]);

        $orderResponse = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Sem Baixa',
            'items' => [['name' => 'Produto Sem Baixa', 'qty' => 3, 'price' => 20]],
        ], $this->headers());
        $orderId = $orderResponse->json('id');

        // Cancela direto de PENDENTE, sem nunca ter ido pra cozinha - nada deve mudar no estoque.
        $this->patchJson("/api/admin/orders/{$orderId}/status", ['status' => 'cancelado'], $this->headers())
            ->assertStatus(200);

        $this->assertEquals(100, (float) $ingrediente->fresh()->qtd_atual);
        $this->assertDatabaseCount('estoque_movimento', 0);
    }

    public function test_movimento_avulso_nao_deixa_estoque_negativo(): void
    {
        $empresa = $this->criarEmpresa();
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 5]);

        $response = $this->postJson('/api/admin/estoque/movimento', [
            'id_ingrediente' => $ingrediente->id_ingrediente,
            'tipo' => 'SAIDA',
            'qtde' => 10,
        ], $this->headers());

        $response->assertStatus(422);
        $this->assertEquals(5, (float) $ingrediente->fresh()->qtd_atual);
    }

    public function test_previsao_calcula_consumo_real_e_ignora_pedido_cancelado(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Previsao']);
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 100]);
        $this->criarReceita($produto, $ingrediente, ['qtde' => 2]);

        foreach ([20, 15, 10] as $diasAtras) {
            DB::table('estoque_movimento')->insert([
                'id_ingrediente' => $ingrediente->id_ingrediente,
                'tipo' => 'SAIDA',
                'qtde' => 5,
                'ds_motivo' => 'Consumo de teste',
                'dt_movimento' => now()->subDays($diasAtras)->toDateTimeString(),
            ]);
        }

        $pedido = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Pedido Cancelado',
            'items' => [['name' => 'Produto Previsao', 'qty' => 1, 'price' => 20]],
        ], $this->headers())->assertStatus(201)->json('id');

        $this->patchJson("/api/admin/orders/{$pedido}/status", [
            'status' => 'enviado_cozinha',
        ], $this->headers())->assertStatus(200);
        $this->patchJson("/api/admin/orders/{$pedido}/status", [
            'status' => 'cancelado',
        ], $this->headers())->assertStatus(200);

        $response = $this->getJson('/api/admin/estoque/previsao?dias=30&prazo_compra=7', $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.dadosSuficientes', true)
            ->assertJsonPath('data.0.consumoPeriodo', 15)
            ->assertJsonPath('data.0.mediaDiaria', 0.5)
            ->assertJsonPath('data.0.mediaMensal', 15)
            ->assertJsonPath('data.0.diasAteEsgotar', 200)
            ->assertJsonPath('data.0.status', 'ESTAVEL');
    }

    public function test_previsao_sinaliza_ruptura_e_recomenda_compra_antecipada(): void
    {
        $empresa = $this->criarEmpresa();
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 1]);

        foreach ([20, 15, 10] as $diasAtras) {
            DB::table('estoque_movimento')->insert([
                'id_ingrediente' => $ingrediente->id_ingrediente,
                'tipo' => 'SAIDA',
                'qtde' => 5,
                'ds_motivo' => 'Consumo de teste',
                'dt_movimento' => now()->subDays($diasAtras)->toDateTimeString(),
            ]);
        }

        $response = $this->getJson('/api/admin/estoque/previsao?dias=30&prazo_compra=7', $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.dadosSuficientes', true)
            ->assertJsonPath('data.0.diasAteEsgotar', 2)
            ->assertJsonPath('data.0.dataPrevistaRuptura', now()->startOfDay()->addDays(2)->toDateString())
            ->assertJsonPath('data.0.dataCompraRecomendada', now()->startOfDay()->toDateString())
            ->assertJsonPath('data.0.status', 'RISCO_RUPTURA');
    }

    public function test_previsao_nao_estima_sem_historico_suficiente(): void
    {
        $empresa = $this->criarEmpresa();
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 20]);

        DB::table('estoque_movimento')->insert([
            'id_ingrediente' => $ingrediente->id_ingrediente,
            'tipo' => 'SAIDA',
            'qtde' => 2,
            'ds_motivo' => 'Consumo isolado',
            'dt_movimento' => now()->subDays(2)->toDateTimeString(),
        ]);

        $response = $this->getJson('/api/admin/estoque/previsao', $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.dadosSuficientes', false)
            ->assertJsonPath('data.0.mediaDiaria', null)
            ->assertJsonPath('data.0.mediaMensal', null)
            ->assertJsonPath('data.0.diasAteEsgotar', null)
            ->assertJsonPath('data.0.status', 'DADOS_INSUFICIENTES');
    }

    public function test_previsao_nao_usa_historico_antigo_sem_consumo_recente(): void
    {
        $empresa = $this->criarEmpresa();
        $ingrediente = $this->criarIngrediente($empresa, ['qtd_atual' => 20]);

        foreach ([85, 78, 71] as $diasAtras) {
            DB::table('estoque_movimento')->insert([
                'id_ingrediente' => $ingrediente->id_ingrediente,
                'tipo' => 'SAIDA',
                'qtde' => 2,
                'ds_motivo' => 'Consumo antigo',
                'dt_movimento' => now()->subDays($diasAtras)->toDateTimeString(),
            ]);
        }

        $response = $this->getJson('/api/admin/estoque/previsao?dias=90', $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.dadosSuficientes', false)
            ->assertJsonPath('data.0.mediaDiaria', null)
            ->assertJsonPath('data.0.diasDesdeUltimoConsumo', 71);
    }

    public function test_resumo_financeiro_calcula_lucro_corretamente(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Receita Financeiro']);

        $orderResponse = $this->postJson('/api/admin/orders', [
            'type' => 'balcao',
            'customer_name' => 'Cliente Financeiro',
            'items' => [['name' => 'Produto Receita Financeiro', 'qty' => 1, 'price' => 100]],
        ], $this->headers());
        $orderId = $orderResponse->json('id');

        // Pagamento nasce PENDENTE via a rota de criacao - marca como aprovado direto no banco
        // pra simular a confirmacao do pagamento (fora do escopo desse teste).
        DB::table('pagamento')->where('id_pedido', $orderId)->update(['status' => 'APROVADO']);

        $ingrediente = $this->criarIngrediente($empresa);
        $this->postJson('/api/admin/compras', [
            'dt_compra' => now()->toDateString(),
            'itens' => [
                ['id_ingrediente' => $ingrediente->id_ingrediente, 'qtde' => 4, 'vl_unitario' => 10],
            ],
        ], $this->headers())->assertStatus(201);

        $response = $this->getJson('/api/admin/financeiro/resumo?meses=1', $this->headers());

        $response->assertStatus(200);
        $mesAtual = $response->json('meses.0');
        $this->assertEquals(100.0, $mesAtual['receita']);
        $this->assertEquals(40.0, $mesAtual['custoCompras']);
        $this->assertEquals(60.0, $mesAtual['lucro']);
    }
}
