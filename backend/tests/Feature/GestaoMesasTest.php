<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class GestaoMesasTest extends TestCase
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
        Schema::create('mesa', function (Blueprint $table) {
            $table->bigIncrements('id_mesa');
            $table->bigInteger('id_empresa');
            $table->integer('nr_mesa');
            $table->string('status_ocupacao')->default('LIVRE');
            $table->string('qr_code_token')->nullable()->unique();
            $table->integer('capacidade')->default(4);
            $table->dateTime('dt_cadastro')->nullable();
            $table->unique(['id_empresa', 'nr_mesa']);
        });
        Schema::create('comanda', function (Blueprint $table) {
            $table->bigIncrements('id_comanda');
            $table->bigInteger('id_mesa');
            $table->string('status');
        });
        Schema::create('pedido', function (Blueprint $table) {
            $table->bigIncrements('id_pedido');
            $table->bigInteger('id_mesa')->nullable();
            $table->string('status');
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
        (require database_path('migrations/2026_11_12_000001_add_fl_ativa_to_mesa.php'))->up();
        DB::table('empresa')->insert(['id_empresa' => 1, 'nm_empresa' => 'Teste']);
        $admin = User::create(['nm_usuario' => 'Admin', 'email' => 'admin@example.test', 'senha_hash' => 'hash', 'perfil' => 'ADMIN', 'fl_ativo' => true]);
        $this->headers = ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken];
    }

    public function test_cria_desativa_e_reativa_mesa_sem_apagar_historico(): void
    {
        $this->postJson('/api/admin/mesas', ['numero' => 10, 'capacidade' => 6])->assertUnauthorized();
        $cliente = User::create(['nm_usuario' => 'Cliente', 'email' => 'cliente@example.test', 'senha_hash' => 'hash', 'perfil' => 'CLIENTE', 'fl_ativo' => true]);
        $this->postJson('/api/admin/mesas', ['numero' => 10, 'capacidade' => 6], ['Authorization' => 'Bearer '.$cliente->createToken('test')->plainTextToken])->assertForbidden();
        $atendente = User::create(['nm_usuario' => 'Atendente', 'email' => 'atendente@example.test', 'senha_hash' => 'hash', 'perfil' => 'ATENDENTE', 'fl_ativo' => true]);
        $this->postJson('/api/admin/mesas', ['numero' => 9, 'capacidade' => 4], ['Authorization' => 'Bearer '.$atendente->createToken('test')->plainTextToken])->assertCreated();
        $id = $this->postJson('/api/admin/mesas', ['numero' => 10, 'capacidade' => 6], $this->headers)
            ->assertCreated()->assertJsonPath('data.numero', 10)->json('data.id');
        $mesa = DB::table('mesa')->where('id_mesa', $id)->first();
        $this->assertSame(6, $mesa->capacidade);
        $this->assertSame(48, strlen($mesa->qr_code_token));
        DB::table('comanda')->insert(['id_mesa' => $id, 'status' => 'PAGA']);
        DB::table('pedido')->insert(['id_mesa' => $id, 'status' => 'FINALIZADO']);
        $this->patchJson("/api/admin/mesas/{$id}/desativar", [], $this->headers)->assertOk();
        $this->assertDatabaseHas('comanda', ['id_mesa' => $id, 'status' => 'PAGA']);
        $this->assertDatabaseHas('pedido', ['id_mesa' => $id, 'status' => 'FINALIZADO']);
        $this->getJson('/api/admin/mesas/inativas', $this->headers)->assertJsonPath('data.0.nr_mesa', 10);
        $this->postJson('/api/admin/mesas', ['numero' => 10, 'capacidade' => 4], $this->headers)->assertUnprocessable()->assertJsonValidationErrors('numero');
        foreach (['', '/ocupar', '/identificar', '/pedidos', '/fechar'] as $sufixo) {
            if ($sufixo === '') $this->getJson("/api/mesa/{$mesa->qr_code_token}")->assertNotFound();
            else $this->postJson("/api/mesa/{$mesa->qr_code_token}{$sufixo}")->assertNotFound();
        }
        $this->postJson('/api/admin/orders', [
            'type' => 'mesa', 'table_number' => 10, 'customer_name' => 'Cliente',
            'items' => [['name' => 'Produto', 'qty' => 1, 'price' => 10]],
        ], $this->headers)->assertUnprocessable();
        $this->patchJson("/api/admin/mesas/{$id}/reativar", [], $this->headers)->assertOk();
        $this->assertDatabaseHas('mesa', ['id_mesa' => $id, 'fl_ativa' => true, 'qr_code_token' => $mesa->qr_code_token]);
        $this->getJson('/api/admin/mesas/inativas', $this->headers)->assertJsonCount(0, 'data');
    }

    public function test_impede_desativar_mesas_ocupadas_com_comanda_ou_pedido_aberto(): void
    {
        $id = $this->postJson('/api/admin/mesas', ['numero' => 1, 'capacidade' => 4], $this->headers)
            ->assertCreated()->json('data.id');
        DB::table('mesa')->where('id_mesa', $id)->update(['status_ocupacao' => 'OCUPADA']);
        $this->patchJson("/api/admin/mesas/{$id}/desativar", [], $this->headers)->assertStatus(409);
        DB::table('mesa')->where('id_mesa', $id)->update(['status_ocupacao' => 'RESERVADA']);
        $this->patchJson("/api/admin/mesas/{$id}/desativar", [], $this->headers)->assertStatus(409);
        DB::table('mesa')->where('id_mesa', $id)->update(['status_ocupacao' => 'LIVRE']);
        DB::table('comanda')->insert(['id_mesa' => $id, 'status' => 'ABERTA']);
        $this->patchJson("/api/admin/mesas/{$id}/desativar", [], $this->headers)->assertStatus(409);
        DB::table('comanda')->where('id_mesa', $id)->update(['status' => 'PAGA']);
        DB::table('pedido')->insert(['id_mesa' => $id, 'status' => 'PREPARANDO']);
        $this->patchJson("/api/admin/mesas/{$id}/desativar", [], $this->headers)->assertStatus(409);
        $this->assertDatabaseHas('mesa', ['id_mesa' => $id, 'fl_ativa' => true]);
        $this->postJson('/api/admin/mesas', ['numero' => 0, 'capacidade' => 0], $this->headers)->assertUnprocessable()->assertJsonValidationErrors(['numero', 'capacidade']);
    }
}
