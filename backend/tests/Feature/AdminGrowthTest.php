<?php

namespace Tests\Feature;

use App\Models\Avaliacao;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\ItemPedido;
use App\Models\Pedido;
use App\Models\PosVenda;
use App\Services\ClienteIdentityService;
use Illuminate\Support\Str;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminGrowthTest extends TestCase
{
    use CriaDadosBasicos;

    public function test_growth_uses_completed_sales_and_whatsapp_ratings(): void
    {
        $empresa = $this->empresaPrincipal();
        $cliente = $this->criarCliente('Cliente Análise', '11912345678');
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['nm_produto' => 'Produto Analisado']);
        $pedido = $this->criarPedido($empresa, $cliente);
        ItemPedido::create([
            'id_pedido' => $pedido->id_pedido,
            'id_produto' => $produto->id_produto,
            'nr_quantidade' => 2,
            'vl_preco_unitario' => 15,
            'vl_subtotal' => 30,
        ]);
        Avaliacao::create([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $cliente->id_cliente,
            'nota' => 4,
        ]);
        PosVenda::create([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $cliente->id_cliente,
            'telefone' => $cliente->telefone_normalizado,
            'status' => 'RESPONDIDA',
            'nota' => 1,
            'ds_comentario' => 'Atendimento atrasado',
            'dt_resposta' => now(),
        ]);

        $response = $this->getJson(
            '/api/admin/growth?inicio=' . now()->toDateString() . '&fim=' . now()->toDateString(),
            $this->adminHeaders()
        );

        $response->assertOk()
            ->assertJsonPath('indicadores.pedidos', 1)
            ->assertJsonPath('indicadores.faturamento', 30)
            ->assertJsonPath('indicadores.nota_media', 1)
            ->assertJsonPath('mais_vendidos.0.nome', 'Produto Analisado')
            ->assertJsonPath('mais_vendidos.0.quantidade', 2)
            ->assertJsonPath('vendas_por_dia.0.produtos.0.nome', 'Produto Analisado')
            ->assertJsonPath('vendas_por_dia.0.produtos.0.quantidade', 2)
            ->assertJsonPath('vendas_por_dia.0.lucro', 0)
            ->assertJsonPath('mais_bem_avaliados.0.media', 1)
            ->assertJsonPath('feedback_negativo.0.nota', 1);
    }

    public function test_growth_handles_legacy_feedback_without_post_sale_surveys(): void
    {
        $empresa = $this->empresaPrincipal();
        $cliente = $this->criarCliente('Cliente Avaliação', '11912345678');
        $pedido = $this->criarPedido($empresa, $cliente);
        Avaliacao::create([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $cliente->id_cliente,
            'nota' => 2,
        ]);

        $this->getJson(
            '/api/admin/growth?inicio=' . now()->toDateString() . '&fim=' . now()->toDateString(),
            $this->adminHeaders()
        )
            ->assertOk()
            ->assertJsonPath('indicadores.nota_media', 2)
            ->assertJsonPath('indicadores.avaliacoes', 1)
            ->assertJsonPath('feedback_negativo.0.nota', 2);
    }

    public function test_client_list_and_audit_show_orders_and_whatsapp_feedback(): void
    {
        $empresa = $this->empresaPrincipal();
        $cliente = $this->criarCliente('Auditoria Cliente', '11976543210');
        $pedido = $this->criarPedido($empresa, $cliente);
        PosVenda::create([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $cliente->id_cliente,
            'telefone' => $cliente->telefone_normalizado,
            'status' => 'RESPONDIDA',
            'nota' => 5,
            'dt_resposta' => now(),
        ]);

        $listagem = $this->getJson('/api/admin/customers?busca=Auditoria', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('data.0.nome', 'Auditoria Cliente')
            ->assertJsonPath('data.0.pedidos', 1);

        $idCliente = $listagem->json('data.0.id');
        $this->getJson("/api/admin/customers/{$idCliente}/audit", $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('cliente.nome', 'Auditoria Cliente')
            ->assertJsonPath('indicadores.pedidos', 1)
            ->assertJsonPath('pos_venda.0.nota', 5)
            ->assertJsonPath('pedidos.0.id', $pedido->id_pedido);
    }

    private function empresaPrincipal(): Empresa
    {
        return Empresa::orderBy('id_empresa')->first() ?? $this->criarEmpresa();
    }

    private function criarCliente(string $nome, string $telefone): Cliente
    {
        return app(ClienteIdentityService::class)->buscarOuCriar(
            $nome,
            $telefone
        );
    }

    private function criarPedido(Empresa $empresa, Cliente $cliente): Pedido
    {
        return Pedido::create([
            'id_empresa' => $empresa->id_empresa,
            'id_cliente' => $cliente->id_cliente,
            'codigo_qr' => (string) Str::uuid(),
            'tipo_pedido' => 'DELIVERY',
            'canal_origem' => 'ONLINE',
            'status' => 'FINALIZADO',
            'vl_total' => 30,
            'vl_taxa_entrega' => 0,
            'dt_conclusao' => now(),
        ]);
    }

    private function adminHeaders(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => "Bearer {$token}"];
    }
}
