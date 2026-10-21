<?php

namespace Tests\Feature;

use App\Models\Promocao;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class PromocaoTest extends TestCase
{
    use CriaDadosBasicos;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                ['lat' => '-23.5614', 'lon' => '-46.6558'],
            ], 200),
        ]);
    }

    public function test_promocao_direta_desconta_somente_produtos_selecionados_no_pedido_online(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $comDesconto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);
        $semDesconto = $this->criarProduto($empresa, $categoria, [
            'nm_produto' => 'Produto sem promoção',
            'vl_preco_base' => 10,
        ]);
        $promocao = $this->criarPromocao($empresa->id_empresa, [
            'tipo' => 'produto',
            'nome' => 'Oferta do dia',
            'tipo_desconto' => 'percentual',
            'valor_desconto' => 10,
        ]);
        $promocao->produtos()->sync([$comDesconto->id_produto]);

        $response = $this->postJson('/api/pedir', [
            'nome' => 'Cliente da oferta',
            'telefone' => '11900001111',
            'tipo_entrega' => 'retirada',
            'payment_method' => 'dinheiro',
            'items' => [
                ['id_produto' => $comDesconto->id_produto, 'qty' => 2],
                ['id_produto' => $semDesconto->id_produto, 'qty' => 1],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('subtotal', 46)
            ->assertJsonPath('discount', 4);

        $pedidoId = \App\Models\Pedido::where('id_cliente', \App\Models\Cliente::where('telefone', '11900001111')->value('id_cliente'))
            ->value('id_pedido');
        $this->assertDatabaseHas('item_pedido', [
            'id_pedido' => $pedidoId,
            'id_produto' => $comDesconto->id_produto,
            'vl_preco_unitario' => 18,
            'vl_subtotal' => 36,
        ]);
        $this->assertDatabaseHas('item_pedido', [
            'id_pedido' => $pedidoId,
            'id_produto' => $semDesconto->id_produto,
            'vl_preco_unitario' => 10,
            'vl_subtotal' => 10,
        ]);
        $this->assertDatabaseHas('promocao_utilizacao', [
            'id_promocao' => $promocao->id_promocao,
            'id_pedido' => $pedidoId,
            'vl_desconto' => 4,
        ]);
    }

    public function test_cupom_fixo_aplica_apenas_aos_produtos_vinculados(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $comDesconto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);
        $produtoDoCupom = $this->criarProduto($empresa, $categoria, [
            'nm_produto' => 'Produto elegível ao cupom',
            'vl_preco_base' => 10,
        ]);
        $cupom = $this->criarPromocao($empresa->id_empresa, [
            'tipo' => 'cupom',
            'nome' => 'Cupom de boas-vindas',
            'codigo' => 'BEMVINDO5',
            'tipo_desconto' => 'fixo',
            'valor_desconto' => 5,
        ]);
        $cupom->produtos()->sync([$produtoDoCupom->id_produto]);
        $direta = $this->criarPromocao($empresa->id_empresa, [
            'tipo' => 'produto',
            'nome' => 'Oferta automática',
            'tipo_desconto' => 'percentual',
            'valor_desconto' => 10,
        ]);
        $direta->produtos()->sync([$comDesconto->id_produto]);
        $payload = [
            'nome' => 'Cliente do cupom',
            'telefone' => '11900002222',
            'tipo_entrega' => 'retirada',
            'payment_method' => 'dinheiro',
            'coupon_code' => 'bemvindo5',
            'items' => [
                ['id_produto' => $comDesconto->id_produto, 'qty' => 1],
                ['id_produto' => $produtoDoCupom->id_produto, 'qty' => 1],
            ],
        ];

        $this->postJson('/api/pedir', $payload)
            ->assertCreated()
            ->assertJsonPath('subtotal', 23)
            ->assertJsonPath('discount', 7);

        $this->postJson('/api/pedir', $payload)
            ->assertCreated()
            ->assertJsonPath('subtotal', 23)
            ->assertJsonPath('discount', 7);
    }

    public function test_desconto_fixo_mantem_subtotal_das_linhas_consistente_com_preco_unitario(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 10]);
        $cupom = $this->criarPromocao($empresa->id_empresa, [
            'tipo' => 'cupom',
            'codigo' => 'REAL1',
            'tipo_desconto' => 'fixo',
            'valor_desconto' => 1,
        ]);
        $cupom->produtos()->sync([$produto->id_produto]);

        $this->postJson('/api/pedir', [
            'nome' => 'Cliente do desconto em reais',
            'telefone' => '11900003333',
            'tipo_entrega' => 'retirada',
            'payment_method' => 'dinheiro',
            'coupon_code' => 'REAL1',
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 3]],
        ])->assertCreated()
            ->assertJsonPath('subtotal', 29)
            ->assertJsonPath('discount', 1);

        $clienteId = \App\Models\Cliente::where('telefone', '11900003333')->value('id_cliente');
        $pedidoId = \App\Models\Pedido::where('id_cliente', $clienteId)->value('id_pedido');
        $this->assertDatabaseHas('item_pedido', [
            'id_pedido' => $pedidoId,
            'id_produto' => $produto->id_produto,
            'nr_quantidade' => 2,
            'vl_preco_unitario' => 9.67,
            'vl_subtotal' => 19.34,
        ]);
        $this->assertDatabaseHas('item_pedido', [
            'id_pedido' => $pedidoId,
            'id_produto' => $produto->id_produto,
            'nr_quantidade' => 1,
            'vl_preco_unitario' => 9.66,
            'vl_subtotal' => 9.66,
        ]);
    }

    public function test_campanha_por_categoria_aplica_automaticamente_e_a_previa_calcula_os_valores(): void
    {
        $empresa = $this->criarEmpresa();
        $categoriaElegivel = $this->criarCategoria($empresa);
        $categoriaComum = \App\Models\Categoria::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_categoria' => 'Categoria comum',
            'fl_ativa' => true,
        ]);
        $elegivel = $this->criarProduto($empresa, $categoriaElegivel, ['vl_preco_base' => 15]);
        $comum = $this->criarProduto($empresa, $categoriaComum, [
            'nm_produto' => 'Produto de outra categoria',
            'vl_preco_base' => 20,
        ]);
        $promocao = $this->criarPromocao($empresa->id_empresa, [
            'nome' => 'Categoria promocional',
            'tipo_desconto' => 'fixo',
            'valor_desconto' => 3,
        ]);
        $promocao->categorias()->sync([$categoriaElegivel->id_categoria]);

        $this->postJson('/api/pedir/precificar', [
            'items' => [
                ['id_produto' => $elegivel->id_produto, 'qty' => 1],
                ['id_produto' => $comum->id_produto, 'qty' => 1],
            ],
        ])->assertOk()
            ->assertJsonPath('subtotal_original', 35)
            ->assertJsonPath('automatic_discount', 3)
            ->assertJsonPath('subtotal', 32);
    }

    public function test_promocao_expirada_nao_e_aplicada_no_pedido(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria, ['vl_preco_base' => 20]);
        $promocao = $this->criarPromocao($empresa->id_empresa, [
            'tipo_desconto' => 'percentual',
            'valor_desconto' => 10,
            'dt_fim' => now()->subMinute(),
        ]);
        $promocao->produtos()->sync([$produto->id_produto]);

        $this->postJson('/api/pedir/precificar', [
            'items' => [['id_produto' => $produto->id_produto, 'qty' => 1]],
        ])->assertOk()
            ->assertJsonPath('automatic_discount', 0)
            ->assertJsonPath('subtotal', 20);
    }

    public function test_admin_pode_criar_e_editar_campanha_com_produtos_e_categorias(): void
    {
        $empresa = $this->criarEmpresa();
        $categoria = $this->criarCategoria($empresa);
        $produto = $this->criarProduto($empresa, $categoria);
        [, $token] = $this->criarAdminComToken();
        $headers = ['Authorization' => "Bearer {$token}"];
        $payload = [
            'tipo' => 'cupom',
            'nome' => 'Frete não, desconto sim',
            'codigo' => 'PROMO10',
            'tipo_desconto' => 'percentual',
            'valor_desconto' => 10,
            'dt_fim' => now()->addDays(3)->toISOString(),
            'produtos' => [$produto->id_produto],
            'categorias' => [$categoria->id_categoria],
        ];

        $response = $this->postJson('/api/admin/promocoes', $payload, $headers)
            ->assertCreated()
            ->assertJsonPath('data.codigo', 'PROMO10')
            ->assertJsonPath('data.status', 'ativa');
        $id = $response->json('data.id');

        $this->patchJson("/api/admin/promocoes/{$id}", ['ativa' => false], $headers)
            ->assertOk()
            ->assertJsonPath('data.ativa', false)
            ->assertJsonPath('data.status', 'inativa');
    }

    private function criarPromocao(int $empresaId, array $overrides): Promocao
    {
        return Promocao::create(array_merge([
            'id_empresa' => $empresaId,
            'tipo' => 'produto',
            'nome' => 'Campanha de teste',
            'codigo' => null,
            'tipo_desconto' => 'percentual',
            'valor_desconto' => 10,
            'valor_minimo_pedido' => 0,
            'limite_utilizacoes' => null,
            'limite_por_cliente' => null,
            'dt_inicio' => now()->subDay(),
            'dt_fim' => null,
            'fl_ativa' => true,
        ], $overrides));
    }
}
