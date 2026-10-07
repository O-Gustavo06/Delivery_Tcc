<?php

namespace Tests\Feature;

use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class MotoboyFlowTest extends TestCase
{
    use CriaDadosBasicos;

    private function adminHeaders(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => "Bearer $token"];
    }

    private function criarPedidoDelivery(array $headers, array $overrides = []): array
    {
        $empresa = $this->criarEmpresa();
        $this->criarCategoria($empresa);

        return $this->postJson('/api/admin/orders', array_merge([
            'type' => 'delivery',
            'customer_name' => 'Cliente ' . uniqid(),
            'address' => 'Rua Teste, 1',
            'items' => [['name' => 'Suco', 'qty' => 1, 'price' => 12]],
        ], $overrides), $headers)->json();
    }

    public function test_bipar_um_pedido_agrupa_outros_pedidos_proximos_na_mesma_rota(): void
    {
        $headers = $this->adminHeaders();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $perto1 = $this->criarPedidoDelivery($headers, ['latitude' => -23.5505, 'longitude' => -46.6333]);
        $perto2 = $this->criarPedidoDelivery($headers, ['latitude' => -23.5510, 'longitude' => -46.6330]);
        $longe = $this->criarPedidoDelivery($headers, ['latitude' => -23.6800, 'longitude' => -46.7800]);

        $response = $this->getJson(
            "/api/motoboy/pedidos/scan/{$perto1['codigo_qr']}",
            ['Authorization' => "Bearer $tokenEntregador"],
        );

        $response->assertOk();
        $idsNaRota = collect($response->json('paradas'))->pluck('id_pedido')->all();

        $this->assertContains($perto1['id'], $idsNaRota);
        $this->assertContains($perto2['id'], $idsNaRota, 'Pedido dentro do raio deveria entrar na mesma rota.');
        $this->assertNotContains($longe['id'], $idsNaRota, 'Pedido fora do raio nao deveria entrar na rota.');
    }

    public function test_bipar_o_mesmo_pedido_duas_vezes_nao_duplica_rota(): void
    {
        $headers = $this->adminHeaders();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->criarPedidoDelivery($headers, ['latitude' => -23.5505, 'longitude' => -46.6333]);

        $primeira = $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);
        $segunda = $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);

        $this->assertSame($primeira->json('id_rota_entrega'), $segunda->json('id_rota_entrega'));
        $this->assertDatabaseCount('rota_entrega', 1);
    }

    public function test_concluir_entrega_de_canal_externo_exige_codigo_de_confirmacao_correto(): void
    {
        $headers = $this->adminHeaders();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->criarPedidoDelivery($headers, [
            'channel' => 'ifood',
            'customer_phone' => '11999998888',
        ]);

        $this->assertSame('8888', $pedido['confirmation_code']);

        $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);

        $entregaId = \App\Models\Entrega::where('id_pedido', $pedido['id'])->value('id_entrega');

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/iniciar", [], ['Authorization' => "Bearer $tokenEntregador"])
            ->assertOk();

        $this->patchJson(
            "/api/motoboy/entregas/{$entregaId}/concluir",
            ['codigo_confirmacao' => '0000'],
            ['Authorization' => "Bearer $tokenEntregador"],
        )->assertStatus(422);

        $this->patchJson(
            "/api/motoboy/entregas/{$entregaId}/concluir",
            ['codigo_confirmacao' => '8888'],
            ['Authorization' => "Bearer $tokenEntregador"],
        )->assertOk()->assertJsonPath('status_entrega', 'ENTREGUE');
    }

    /**
     * Regressao: concluir sem mandar a chave "codigo_confirmacao" (nem null, ausente mesmo)
     * num pedido que EXIGE codigo derrubava a API com erro 500 (undefined array key), em vez
     * de devolver 422 igual a quando manda um codigo errado.
     */
    public function test_concluir_entrega_de_canal_externo_sem_enviar_codigo_retorna_422_sem_quebrar(): void
    {
        $headers = $this->adminHeaders();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->criarPedidoDelivery($headers, [
            'channel' => '99food',
            'customer_phone' => '11999997777',
        ]);

        $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);
        $entregaId = \App\Models\Entrega::where('id_pedido', $pedido['id'])->value('id_entrega');

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/iniciar", [], ['Authorization' => "Bearer $tokenEntregador"]);

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/concluir", [], ['Authorization' => "Bearer $tokenEntregador"])
            ->assertStatus(422);
    }

    public function test_pedido_de_loja_conclui_sem_precisar_de_codigo(): void
    {
        $headers = $this->adminHeaders();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->criarPedidoDelivery($headers);

        $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);
        $entregaId = \App\Models\Entrega::where('id_pedido', $pedido['id'])->value('id_entrega');

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/iniciar", [], ['Authorization' => "Bearer $tokenEntregador"]);

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/concluir", [], ['Authorization' => "Bearer $tokenEntregador"])
            ->assertOk()
            ->assertJsonPath('status_entrega', 'ENTREGUE');
    }

    public function test_iniciar_e_concluir_entrega_atualiza_o_status_do_pedido_tambem(): void
    {
        $headers = $this->adminHeaders();
        $entregador = $this->criarEntregador();
        $tokenEntregador = $entregador->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->criarPedidoDelivery($headers);
        $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenEntregador"]);
        $entregaId = \App\Models\Entrega::where('id_pedido', $pedido['id'])->value('id_entrega');

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/iniciar", [], ['Authorization' => "Bearer $tokenEntregador"]);

        // O admin/cozinha nao deveria precisar clicar "Saiu entrega" manualmente - o motoboy
        // iniciando a entrega ja reflete isso no pedido.
        $this->assertDatabaseHas('pedido', ['id_pedido' => $pedido['id'], 'status' => 'ENTREGANDO']);

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/concluir", [], ['Authorization' => "Bearer $tokenEntregador"]);

        $this->assertDatabaseHas('pedido', ['id_pedido' => $pedido['id'], 'status' => 'FINALIZADO']);

        // O motoboy concluindo a entrega tambem precisa aprovar o pagamento (mesma regra do
        // AdminOrderController::updateStatus) - senao o pedido some da lista de "pagamentos
        // pendentes" mas o pagamento em si nunca conta como receita no financeiro.
        $this->assertDatabaseHas('pagamento', ['id_pedido' => $pedido['id'], 'status' => 'APROVADO']);
    }

    public function test_outro_entregador_nao_consegue_mexer_em_entrega_que_nao_e_dele(): void
    {
        $headers = $this->adminHeaders();
        $dono = $this->criarEntregador();
        $outro = $this->criarEntregador();
        $tokenDono = $dono->usuario->createToken('teste')->plainTextToken;
        $tokenOutro = $outro->usuario->createToken('teste')->plainTextToken;

        $pedido = $this->criarPedidoDelivery($headers);
        $this->getJson("/api/motoboy/pedidos/scan/{$pedido['codigo_qr']}", ['Authorization' => "Bearer $tokenDono"]);
        $entregaId = \App\Models\Entrega::where('id_pedido', $pedido['id'])->value('id_entrega');

        $this->patchJson("/api/motoboy/entregas/{$entregaId}/iniciar", [], ['Authorization' => "Bearer $tokenOutro"])
            ->assertStatus(403);
    }
}
