<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class FiscalEstruturaTest extends TestCase
{
    private array $headers;

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');

        Schema::create('empresa', function (Blueprint $table) {
            $table->bigIncrements('id_empresa');
            $table->string('nm_empresa');
        });
        Schema::create('produto', function (Blueprint $table) {
            $table->bigIncrements('id_produto');
            $table->bigInteger('id_empresa');
            $table->string('nm_produto');
        });
        Schema::create('pedido', function (Blueprint $table) {
            $table->bigIncrements('id_pedido');
            $table->bigInteger('id_empresa');
        });
        Schema::create('item_pedido', function (Blueprint $table) {
            $table->bigIncrements('id_item_pedido');
            $table->bigInteger('id_pedido');
            $table->bigInteger('id_produto');
            $table->integer('nr_quantidade');
            $table->decimal('vl_preco_unitario', 10, 2);
            $table->decimal('vl_subtotal', 10, 2);
        });
        Schema::create('compra', function (Blueprint $table) {
            $table->bigIncrements('id_compra');
            $table->bigInteger('id_empresa');
        });
        Schema::create('ingrediente', function (Blueprint $table) {
            $table->bigIncrements('id_ingrediente');
            $table->string('nm_ingrediente');
            $table->decimal('qtd_atual', 10, 3);
        });
        Schema::create('compra_item', function (Blueprint $table) {
            $table->bigIncrements('id_compra_item');
            $table->bigInteger('id_compra');
            $table->bigInteger('id_ingrediente');
            $table->decimal('qtde', 10, 3);
            $table->decimal('vl_unitario', 10, 2);
            $table->decimal('vl_subtotal', 10, 2);
        });
        Schema::create('usuario', function (Blueprint $table) {
            $table->bigIncrements('id_usuario');
            $table->string('nm_usuario');
            $table->string('email');
            $table->string('senha_hash');
            $table->string('perfil');
            $table->boolean('fl_ativo');
        });
        (require database_path('migrations/2026_05_13_002645_create_personal_access_tokens_table.php'))->up();
        (require database_path('migrations/2026_11_11_000001_create_fiscal_estrutura.php'))->up();

        DB::table('empresa')->insert([['id_empresa' => 1, 'nm_empresa' => 'Teste'], ['id_empresa' => 2, 'nm_empresa' => 'Outra']]);
        DB::table('produto')->insert([['id_produto' => 1, 'id_empresa' => 1, 'nm_produto' => 'Produto'], ['id_produto' => 2, 'id_empresa' => 2, 'nm_produto' => 'Outro']]);
        $admin = User::create(['nm_usuario' => 'Admin', 'email' => 'admin@example.test', 'senha_hash' => 'hash', 'perfil' => 'ADMIN', 'fl_ativo' => true]);
        $this->headers = ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken];
    }

    public function test_acesso_e_validacao_do_cadastro_fiscal(): void
    {
        $this->getJson('/api/admin/fiscal/documentos')->assertUnauthorized();
        $outro = User::create(['nm_usuario' => 'Atendente', 'email' => 'outro@example.test', 'senha_hash' => 'hash', 'perfil' => 'ATENDENTE', 'fl_ativo' => true]);
        $this->getJson('/api/admin/fiscal/documentos', ['Authorization' => 'Bearer '.$outro->createToken('test')->plainTextToken])->assertForbidden();
        $this->putJson('/api/admin/produtos/2/fiscal', ['ncm' => '12345678'], $this->headers)->assertNotFound();
        $this->putJson('/api/admin/produtos/1/fiscal', ['ncm' => '123', 'aliquota_icms' => 101], $this->headers)
            ->assertUnprocessable()->assertJsonValidationErrors(['ncm', 'aliquota_icms']);
        $this->putJson('/api/admin/produtos/1/fiscal', [
            'ncm' => '01234567', 'cest' => '0123456', 'cfop' => '5102', 'cst_csosn' => '010', 'origem' => '0',
            'aliquota_icms' => '12.3456', 'aliquota_pis' => null,
        ], $this->headers)->assertOk()->assertJsonPath('data.ncm', '01234567')->assertJsonPath('data.cst_csosn', '010');
        $this->getJson('/api/admin/produtos/1/fiscal', $this->headers)->assertOk()->assertJsonPath('data.origem', '0');
    }

    public function test_rascunho_preserva_referencias_e_nao_calcula_nem_emite(): void
    {
        DB::table('pedido')->insert([['id_pedido' => 1, 'id_empresa' => 1], ['id_pedido' => 2, 'id_empresa' => 2]]);
        DB::table('item_pedido')->insert(['id_pedido' => 1, 'id_produto' => 1, 'nr_quantidade' => 2, 'vl_preco_unitario' => 10, 'vl_subtotal' => 20]);
        $this->putJson('/api/admin/fiscal/configuracao', ['regime' => 'SIMPLES_NACIONAL', 'uf' => 'SP'], $this->headers)->assertOk();
        $this->putJson('/api/admin/produtos/1/fiscal', ['ncm' => '01234567', 'aliquota_icms' => 12], $this->headers)->assertOk();
        $this->postJson('/api/admin/fiscal/documentos', ['modelo' => 'NFE', 'direcao' => 'SAIDA', 'id_pedido' => 2], $this->headers)->assertNotFound();
        $this->postJson('/api/admin/fiscal/documentos', ['modelo' => 'NFE', 'direcao' => 'SAIDA', 'id_compra' => 1], $this->headers)->assertUnprocessable();
        $criado = $this->postJson('/api/admin/fiscal/documentos', [
            'modelo' => 'NFCE', 'direcao' => 'SAIDA', 'id_pedido' => 1, 'status' => 'AUTORIZADA',
        ], $this->headers)->assertCreated()->assertJsonPath('data.status', 'RASCUNHO')
            ->assertJsonPath('data.tributos', null)->assertJsonPath('data.itens.0.referencia_fiscal.ncm', '01234567');
        $id = $criado->json('data.id_documento_fiscal');
        $this->putJson('/api/admin/produtos/1/fiscal', ['ncm' => '87654321'], $this->headers)->assertOk();
        $this->putJson('/api/admin/fiscal/configuracao', ['regime' => 'LUCRO_REAL', 'uf' => 'RJ'], $this->headers)->assertOk();
        $this->getJson("/api/admin/fiscal/documentos/{$id}", $this->headers)->assertOk()
            ->assertJsonPath('data.contexto_fiscal.uf', 'SP')
            ->assertJsonPath('data.itens.0.referencia_fiscal.ncm', '01234567');
        $this->getJson('/api/admin/fiscal/documentos?status=AUTORIZADA', $this->headers)->assertOk()
            ->assertJsonPath('emissao_disponivel', false)->assertJsonPath('apuracao_disponivel', false)
            ->assertJsonCount(0, 'documentos.data')->assertJsonPath('resumo.RASCUNHO', 1);
        $this->assertSame(1, DB::table('item_pedido')->count());
    }

    public function test_rascunho_de_entrada_nao_altera_compra_ou_estoque(): void
    {
        DB::table('compra')->insert(['id_compra' => 1, 'id_empresa' => 1]);
        DB::table('ingrediente')->insert(['id_ingrediente' => 1, 'nm_ingrediente' => 'Farinha', 'qtd_atual' => 10]);
        DB::table('compra_item')->insert(['id_compra' => 1, 'id_ingrediente' => 1, 'qtde' => 3, 'vl_unitario' => 2, 'vl_subtotal' => 6]);
        $this->postJson('/api/admin/fiscal/documentos', ['modelo' => 'NFE', 'direcao' => 'ENTRADA', 'id_compra' => 1], $this->headers)
            ->assertCreated()->assertJsonPath('data.itens.0.nome', 'Farinha')->assertJsonPath('data.status', 'RASCUNHO');
        $this->assertEquals(10, DB::table('ingrediente')->value('qtd_atual'));
        $this->assertSame(1, DB::table('compra_item')->count());
    }

    public function test_filtros_paginacao_e_operacoes_oficiais_indisponiveis(): void
    {
        foreach (range(1, 21) as $numero) {
            $this->postJson('/api/admin/fiscal/documentos', [
                'modelo' => 'NFE', 'direcao' => 'SAIDA',
            ], $this->headers)->assertCreated();
        }
        $this->getJson('/api/admin/fiscal/documentos?direcao=SAIDA&page=2', $this->headers)
            ->assertOk()->assertJsonPath('documentos.total', 21)->assertJsonCount(1, 'documentos.data');
        $this->getJson('/api/admin/fiscal/documentos?direcao=ENTRADA', $this->headers)
            ->assertOk()->assertJsonCount(0, 'documentos.data');
        $this->getJson('/api/admin/fiscal/documentos?status=INVALIDO', $this->headers)->assertUnprocessable();
        $this->postJson('/api/admin/fiscal/documentos/1/emitir', [], $this->headers)->assertNotFound();
        $this->postJson('/api/admin/fiscal/documentos/1/cancelar', [], $this->headers)->assertNotFound();
        $this->getJson('/api/admin/fiscal/documentos/1', $this->headers)->assertJsonPath('data.status', 'RASCUNHO');
    }

    public function test_xml_interno_de_nfce_pode_ser_gerado_editado_e_recuperado(): void
    {
        Storage::set('local', Storage::fake('fiscal_xml_'.uniqid()));
        DB::table('empresa')->where('id_empresa', 1)->update(['nm_empresa' => 'Empresa & Filhos']);
        DB::table('pedido')->insert(['id_pedido' => 1, 'id_empresa' => 1]);
        DB::table('item_pedido')->insert(['id_pedido' => 1, 'id_produto' => 1, 'nr_quantidade' => 2, 'vl_preco_unitario' => 10, 'vl_subtotal' => 20]);
        $this->putJson('/api/admin/fiscal/configuracao', ['regime' => 'SIMPLES_NACIONAL', 'uf' => 'SP'], $this->headers)->assertOk();
        $id = $this->postJson('/api/admin/fiscal/documentos', ['modelo' => 'NFCE', 'direcao' => 'SAIDA', 'id_pedido' => 1], $this->headers)
            ->assertCreated()->json('data.id_documento_fiscal');
        $path = "/api/admin/fiscal/documentos/{$id}/xml-rascunho";

        $this->getJson($path)->assertUnauthorized();
        $this->getJson($path, $this->headers)->assertOk()->assertJsonPath('data', null);
        $xml = $this->postJson("{$path}/gerar", [], $this->headers)->assertOk()->json('data');
        $dom = new \DOMDocument;
        $this->assertTrue($dom->loadXML($xml));
        $this->assertSame('rascunhoNFCe', $dom->documentElement->tagName);
        $this->assertSame('NAO_AUTORIZADO', $dom->documentElement->getAttribute('status'));
        $this->assertSame('Empresa & Filhos', $dom->getElementsByTagName('nome')->item(0)->textContent);
        $this->assertSame('Produto', $dom->getElementsByTagName('nome')->item(1)->textContent);
        $this->assertSame('SP', $dom->getElementsByTagName('uf')->item(0)->textContent);
        $this->assertStringNotContainsString('protNFe', $xml);
        $this->assertStringNotContainsString('Signature', $xml);
        $editado = str_replace('Produto', 'Produto editado', $xml);
        $this->putJson($path, ['xml' => $editado], $this->headers)->assertOk();
        $this->getJson($path, $this->headers)->assertOk()->assertJsonPath('data', $editado);
    }

    public function test_xml_interno_rejeita_documentos_inadequados_e_xml_inseguro(): void
    {
        Storage::set('local', Storage::fake('fiscal_xml_'.uniqid()));
        $id = $this->postJson('/api/admin/fiscal/documentos', ['modelo' => 'NFCE', 'direcao' => 'SAIDA'], $this->headers)
            ->assertCreated()->json('data.id_documento_fiscal');
        $path = "/api/admin/fiscal/documentos/{$id}/xml-rascunho";
        $valido = '<rascunhoNFCe status="NAO_AUTORIZADO"><itens/></rascunhoNFCe>';
        $this->putJson($path, ['xml' => $valido], $this->headers)->assertOk();
        foreach ([
            '<rascunhoNFCe>',
            '<?xml version="1.0" encoding="ISO-8859-1"?><NFe/>',
            '<!DOCTYPE rascunhoNFCe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rascunhoNFCe status="NAO_AUTORIZADO">&xxe;</rascunhoNFCe>',
        ] as $invalido) {
            $this->putJson($path, ['xml' => $invalido], $this->headers)->assertUnprocessable()->assertJsonValidationErrors('xml');
        }
        $this->getJson($path, $this->headers)->assertJsonPath('data', $valido);
        foreach ([['NFE', 'SAIDA', 'RASCUNHO'], ['NFCE', 'ENTRADA', 'RASCUNHO'], ['NFCE', 'SAIDA', 'AUTORIZADA']] as [$modelo, $direcao, $status]) {
            $outro = DB::table('documento_fiscal')->insertGetId([
                'id_empresa' => 1, 'modelo' => $modelo, 'direcao' => $direcao, 'status' => $status,
                'contexto_fiscal' => '{}', 'itens' => '[]', 'dt_cadastro' => now(), 'dt_atualizacao' => now(),
            ]);
            $this->postJson("/api/admin/fiscal/documentos/{$outro}/xml-rascunho/gerar", [], $this->headers)->assertNotFound();
        }
        $outro = DB::table('documento_fiscal')->insertGetId([
            'id_empresa' => 2, 'modelo' => 'NFCE', 'direcao' => 'SAIDA', 'status' => 'RASCUNHO',
            'contexto_fiscal' => '{}', 'itens' => '[]', 'dt_cadastro' => now(), 'dt_atualizacao' => now(),
        ]);
        $this->getJson("/api/admin/fiscal/documentos/{$outro}/xml-rascunho", $this->headers)->assertNotFound();
    }

    public function test_editor_livre_aceita_xml_colado_e_separa_usuarios(): void
    {
        Storage::set('local', Storage::fake('fiscal_xml_'.uniqid()));
        $path = '/api/admin/fiscal/xml-editor';
        $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<nfeProc xmlns=\"http://www.portalfiscal.inf.br/nfe\"><NFe/><protNFe/></nfeProc>\n";
        $this->getJson($path)->assertUnauthorized();
        $this->getJson($path, $this->headers)->assertOk()->assertJsonPath('data', null);
        $this->putJson($path, ['xml' => $xml], $this->headers)->assertOk();
        $this->getJson($path, $this->headers)->assertOk()->assertJsonPath('data', $xml);
        $this->putJson($path, ['xml' => '<nfeProc>'], $this->headers)->assertUnprocessable();
        $this->putJson($path, ['xml' => '<!DOCTYPE nfeProc [<!ENTITY x SYSTEM "file:///etc/passwd">]><nfeProc>&x;</nfeProc>'], $this->headers)->assertUnprocessable();
        $this->getJson($path, $this->headers)->assertJsonPath('data', $xml);
        $outro = User::create(['nm_usuario' => 'Outro admin', 'email' => 'outro-admin@example.test', 'senha_hash' => 'hash', 'perfil' => 'ADMIN', 'fl_ativo' => true]);
        $headers = ['Authorization' => 'Bearer '.$outro->createToken('test')->plainTextToken];
        $this->getJson($path, $headers)->assertOk()->assertJsonPath('data', null);
    }
}
