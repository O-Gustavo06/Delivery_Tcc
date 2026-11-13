<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\AdminOrderController;
use App\Http\Controllers\Api\Admin\AdminWhatsAppController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class PermissoesPerfisTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');

        Schema::create('usuario', function (Blueprint $table) {
            $table->bigIncrements('id_usuario');
            $table->string('nm_usuario');
            $table->string('email');
            $table->string('senha_hash');
            $table->string('perfil');
            $table->boolean('fl_ativo');
        });
        Schema::create('entregador', function (Blueprint $table) {
            $table->bigIncrements('id_entregador');
            $table->bigInteger('id_usuario')->unique();
            $table->boolean('fl_online')->default(false);
            $table->dateTime('dt_cadastro')->nullable();
            $table->dateTime('dt_atualizacao')->nullable();
        });
        Schema::create('rota_entrega', function (Blueprint $table) {
            $table->bigIncrements('id_rota_entrega');
            $table->bigInteger('id_entregador');
            $table->string('status');
        });
        Schema::create('empresa', function (Blueprint $table) {
            $table->bigIncrements('id_empresa');
        });
        Schema::create('categoria', function (Blueprint $table) {
            $table->bigIncrements('id_categoria');
            $table->bigInteger('id_empresa');
            $table->string('nm_categoria');
            $table->boolean('fl_ativa');
            $table->integer('nr_ordem')->default(0);
            $table->dateTime('dt_cadastro')->nullable();
        });
        Schema::create('pedido', function (Blueprint $table) {
            $table->bigIncrements('id_pedido');
            $table->dateTime('dt_pedido')->nullable();
        });
        Schema::create('mesa', function (Blueprint $table) {
            $table->bigIncrements('id_mesa');
            $table->bigInteger('id_empresa');
            $table->boolean('fl_ativa');
            $table->integer('nr_mesa');
        });
        Schema::create('mesa_fila_espera', function (Blueprint $table) {
            $table->bigIncrements('id_fila_espera');
            $table->bigInteger('id_empresa');
            $table->dateTime('dt_cadastro')->nullable();
        });
        Schema::create('dashboard_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('slug');
            $table->text('payload_json')->nullable();
        });
        Schema::create('produto', function (Blueprint $table) {
            $table->bigIncrements('id_produto');
            $table->bigInteger('id_empresa');
            $table->bigInteger('id_categoria');
            $table->boolean('fl_ativo');
            $table->integer('tempo_preparo_min')->nullable();
        });
        (require database_path('migrations/2026_05_13_002645_create_personal_access_tokens_table.php'))->up();
        DB::table('empresa')->insert(['id_empresa' => 1]);
        DB::table('categoria')->insert(['id_categoria' => 1, 'id_empresa' => 1, 'nm_categoria' => 'Bebidas', 'fl_ativa' => true]);
    }

    private function usuario(string $perfil, bool $ativo = true): User
    {
        return User::create([
            'nm_usuario' => $perfil,
            'email' => strtolower($perfil).'@example.test',
            'senha_hash' => Hash::make('senha12345'),
            'perfil' => $perfil,
            'fl_ativo' => $ativo,
        ]);
    }

    private function headers(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    public function test_perfis_de_painel_e_cardapio_somente_leitura(): void
    {
        $atendente = $this->headers($this->usuario('ATENDENTE'));
        $gerente = $this->headers($this->usuario('GERENTE'));
        $admin = $this->headers($this->usuario('ADMIN'));
        $entregador = $this->headers($this->usuario('ENTREGADOR'));

        foreach ([$admin, $gerente, $atendente] as $headers) {
            $this->getJson('/api/admin/categorias', $headers)->assertOk()->assertJsonPath('data.0.nome', 'Bebidas');
        }
        foreach ([$admin, $gerente] as $headers) {
            $this->patchJson('/api/admin/categorias/1', ['nome' => 'Bebidas'], $headers)->assertOk();
            $this->getJson('/api/admin/users', $headers)->assertOk();
        }
        $this->mock(AdminOrderController::class)->shouldReceive('index')->once()->andReturn(response()->json(['data' => []]));
        $this->mock(AdminWhatsAppController::class)->shouldReceive('status')->once()->andReturn(response()->json(['status' => 'ok']));
        $this->getJson('/api/admin/orders', $atendente)->assertOk();
        $this->getJson('/api/admin/whatsapp/status', $atendente)->assertOk();
        foreach ([
            ['POST', '/api/admin/categorias'],
            ['PATCH', '/api/admin/categorias/1'],
            ['POST', '/api/admin/produtos'],
            ['PATCH', '/api/admin/produtos/1'],
            ['DELETE', '/api/admin/produtos/1'],
            ['PUT', '/api/admin/produtos/1/receita'],
            ['GET', '/api/admin/ingredientes'],
            ['GET', '/api/admin/users'],
            ['GET', '/api/admin/financeiro/resumo'],
            ['GET', '/api/admin/fiscal/configuracao'],
            ['PATCH', '/api/admin/empresa'],
        ] as [$method, $url]) {
            $this->json($method, $url, [], $atendente)->assertForbidden();
        }
        $this->getJson('/api/admin/categorias', $entregador)->assertForbidden();
        $this->getJson('/api/admin/orders', $entregador)->assertForbidden();
        $this->assertDatabaseHas('categoria', ['id_categoria' => 1, 'nm_categoria' => 'Bebidas']);
    }

    public function test_acesso_motoboy_com_credenciais_cria_identidade_propria_sem_duplicar(): void
    {
        $atendente = $this->usuario('ATENDENTE');
        $credenciais = ['email' => $atendente->email, 'password' => 'senha12345'];
        $token = $this->postJson('/api/auth/login-motoboy', $credenciais)->assertOk()->assertJsonPath('user.id', $atendente->id_usuario)->json('token');
        $this->postJson('/api/auth/login-motoboy', $credenciais)->assertOk();
        $this->assertSame(1, DB::table('entregador')->where('id_usuario', $atendente->id_usuario)->count());
        $headers = ['Authorization' => 'Bearer '.$token];
        $this->getJson('/api/motoboy/rotas/ativa', $headers)->assertNotFound();
        $outro = $this->usuario('ENTREGADOR');
        DB::table('entregador')->insert(['id_entregador' => 999, 'id_usuario' => $outro->id_usuario]);
        DB::table('rota_entrega')->insert(['id_rota_entrega' => 99, 'id_entregador' => 999, 'status' => 'MONTANDO']);
        $this->patchJson('/api/motoboy/rotas/99/reordenar', ['ordem' => [1]], $headers)->assertNotFound();
        $this->getJson('/api/admin/categorias', $this->headers($outro))->assertForbidden();

        $this->postJson('/api/auth/login-motoboy', ['email' => $atendente->email, 'password' => 'errada'])->assertUnauthorized();
        $cliente = $this->usuario('CLIENTE');
        $this->postJson('/api/auth/login-motoboy', ['email' => $cliente->email, 'password' => 'senha12345'])->assertForbidden();
        $this->assertDatabaseMissing('entregador', ['id_usuario' => $cliente->id_usuario]);
        $inativo = $this->usuario('GERENTE', false);
        $this->postJson('/api/auth/login-motoboy', ['email' => $inativo->email, 'password' => 'senha12345'])->assertForbidden();
    }

    public function test_dashboard_do_atendimento_retorna_apenas_dados_operacionais(): void
    {
        $headers = $this->headers($this->usuario('ATENDENTE'));
        $response = $this->getJson('/api/admin/dashboard', $headers)->assertOk()
            ->assertJsonStructure(['kitchenData', 'tablesData', 'deliveryData']);

        $this->assertSame(['kitchenData', 'tablesData', 'deliveryData'], array_keys($response->json()));
    }

    public function test_admin_e_gerente_tambem_podem_entrar_no_aplicativo_de_entregas(): void
    {
        foreach (['ADMIN', 'GERENTE'] as $perfil) {
            $user = $this->usuario($perfil);
            $this->postJson('/api/auth/login-motoboy', ['email' => $user->email, 'password' => 'senha12345'])
                ->assertOk()->assertJsonPath('user.id', $user->id_usuario);
            $this->assertDatabaseHas('entregador', ['id_usuario' => $user->id_usuario]);
        }
    }
}
