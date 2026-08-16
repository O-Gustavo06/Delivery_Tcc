<?php

namespace Tests\Feature;

use App\Models\Empresa;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminOrderTest extends TestCase
{
    use CriaDadosBasicos;

    private function headers(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => "Bearer $token"];
    }

    /** Empresa + categoria: o controller precisa de uma categoria pra criar produto novo. */
    private function empresaPronta(): Empresa
    {
        $empresa = $this->criarEmpresa();
        $this->criarCategoria($empresa);

        return $empresa;
    }

    public function test_cria_pedido_delivery_com_cep_geocodifica_automaticamente(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '-23.5614', 'lon' => '-46.6558'],
            ], 200),
        ]);

        $this->empresaPronta();

        $response = $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'customer_name' => 'Cliente Cep',
            'address' => 'Rua Augusta, 500',
            'cep' => '01305-000',
            'items' => [['name' => 'Pizza', 'qty' => 1, 'price' => 39.90]],
        ], $this->headers());

        $response->assertStatus(201);
        $this->assertDatabaseHas('entrega', [
            'id_pedido' => $response->json('id'),
            'latitude_destino' => -23.5614,
            'longitude_destino' => -46.6558,
        ]);
    }

    public function test_cria_pedido_de_mesa(): void
    {
        $empresa = $this->empresaPronta();
        $mesa = $this->criarMesa($empresa, ['nr_mesa' => 42]);

        $response = $this->postJson('/api/admin/orders', [
            'type' => 'mesa',
            'table_number' => 42,
            'customer_name' => 'Cliente Mesa',
            'items' => [['name' => 'Suco', 'qty' => 2, 'price' => 10]],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('type', 'mesa')
            ->assertJsonPath('total', 20)
            ->assertJsonPath('codigo_qr', fn ($qr) => !empty($qr));

        $this->assertDatabaseHas('mesa', ['id_mesa' => $mesa->id_mesa, 'status_ocupacao' => 'OCUPADA']);
    }

    public function test_cria_pedido_delivery_dinheiro_com_troco(): void
    {
        $this->empresaPronta();

        $response = $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'customer_name' => 'Cliente Delivery',
            'address' => 'Rua Teste, 1',
            'payment_method' => 'dinheiro',
            'change_for' => 50,
            'items' => [['name' => 'Pizza', 'qty' => 1, 'price' => 39.90]],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('change_for', 50)
            ->assertJsonPath('payment_method', 'dinheiro');

        $this->assertDatabaseHas('entrega', ['status_entrega' => 'AGUARDANDO']);
    }

    public function test_delivery_ifood_sem_telefone_e_rejeitado(): void
    {
        $this->empresaPronta();

        $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'channel' => 'ifood',
            'customer_name' => 'Cliente iFood',
            'address' => 'Rua Teste, 1',
            'items' => [['name' => 'Pizza', 'qty' => 1, 'price' => 39.90]],
        ], $this->headers())->assertStatus(422);
    }

    public function test_delivery_ifood_com_telefone_gera_codigo_de_confirmacao_com_ultimos_4_digitos(): void
    {
        $this->empresaPronta();

        $response = $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'channel' => 'ifood',
            'customer_name' => 'Cliente iFood',
            'customer_phone' => '(11) 91234-5678',
            'address' => 'Rua Teste, 1',
            'items' => [['name' => 'Pizza', 'qty' => 1, 'price' => 39.90]],
        ], $this->headers());

        $response->assertStatus(201)->assertJsonPath('confirmation_code', '5678');
    }

    public function test_numeracao_do_delivery_e_separada_e_comeca_do_1(): void
    {
        $empresa = $this->empresaPronta();
        $this->criarMesa($empresa, ['nr_mesa' => 3]);

        $delivery1 = $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'customer_name' => 'Cliente Delivery 1',
            'address' => 'Rua Teste, 1',
            'items' => [['name' => 'Pizza', 'qty' => 1, 'price' => 39.90]],
        ], $this->headers());

        $mesa = $this->postJson('/api/admin/orders', [
            'type' => 'mesa',
            'table_number' => 3,
            'customer_name' => 'Cliente Mesa',
            'items' => [['name' => 'Suco', 'qty' => 1, 'price' => 10]],
        ], $this->headers());

        $delivery2 = $this->postJson('/api/admin/orders', [
            'type' => 'delivery',
            'customer_name' => 'Cliente Delivery 2',
            'address' => 'Rua Teste, 2',
            'items' => [['name' => 'Pizza', 'qty' => 1, 'price' => 39.90]],
        ], $this->headers());

        $delivery1->assertJsonPath('delivery_number', 1);
        $delivery2->assertJsonPath('delivery_number', 2);
        // Mesa nao entra na contagem do delivery nem ganha um delivery_number.
        $mesa->assertJsonPath('delivery_number', null);
    }

    public function test_pedido_de_mesa_nao_exige_telefone_nem_gera_codigo(): void
    {
        $empresa = $this->empresaPronta();
        $this->criarMesa($empresa, ['nr_mesa' => 7]);

        $response = $this->postJson('/api/admin/orders', [
            'type' => 'mesa',
            'table_number' => 7,
            'customer_name' => 'Cliente Mesa',
            'items' => [['name' => 'Suco', 'qty' => 1, 'price' => 10]],
        ], $this->headers());

        $response->assertStatus(201)->assertJsonPath('confirmation_code', null);
    }

    public function test_mudar_status_para_entregando_nao_afeta_entrega_de_pedido_que_nao_e_delivery(): void
    {
        $empresa = $this->empresaPronta();
        $this->criarMesa($empresa, ['nr_mesa' => 9]);

        $order = $this->postJson('/api/admin/orders', [
            'type' => 'mesa',
            'table_number' => 9,
            'customer_name' => 'Cliente Mesa',
            'items' => [['name' => 'Suco', 'qty' => 1, 'price' => 10]],
        ], $this->headers())->json();

        // So confere que a transicao de status nao quebra pedidos sem entrega associada.
        $this->patchJson("/api/admin/orders/{$order['id']}/status", ['status' => 'entregue'], $this->headers())
            ->assertOk();
    }
}
