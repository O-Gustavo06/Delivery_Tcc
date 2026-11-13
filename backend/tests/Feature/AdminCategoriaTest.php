<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminCategoriaTest extends TestCase
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
        Schema::create('categoria', function (Blueprint $table) {
            $table->bigIncrements('id_categoria');
            $table->bigInteger('id_empresa');
            $table->string('nm_categoria');
            $table->boolean('fl_ativa')->default(true);
            $table->integer('nr_ordem')->default(0);
            $table->dateTime('dt_cadastro')->nullable();
        });
        Schema::create('produto', function (Blueprint $table) {
            $table->bigIncrements('id_produto');
            $table->bigInteger('id_categoria');
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
        DB::table('empresa')->insert([
            ['id_empresa' => 1, 'nm_empresa' => 'Teste'],
            ['id_empresa' => 2, 'nm_empresa' => 'Outra empresa'],
        ]);
        DB::table('categoria')->insert([
            ['id_categoria' => 1, 'id_empresa' => 1, 'nm_categoria' => 'Bebidas', 'fl_ativa' => false],
            ['id_categoria' => 2, 'id_empresa' => 2, 'nm_categoria' => 'Outra', 'fl_ativa' => true],
        ]);
        DB::table('produto')->insert(['id_produto' => 1, 'id_categoria' => 1]);
        $admin = User::create(['nm_usuario' => 'Admin', 'email' => 'admin@example.test', 'senha_hash' => 'hash', 'perfil' => 'ADMIN', 'fl_ativo' => true]);
        $this->headers = ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken];
    }

    public function test_altera_nome_preservando_categoria_e_produtos_vinculados(): void
    {
        $this->patchJson('/api/admin/categorias/1', ['nome' => 'Sucos'], $this->headers)
            ->assertOk()->assertJsonPath('id', 1)->assertJsonPath('nome', 'Sucos')->assertJsonPath('ativa', false);

        $this->getJson('/api/admin/categorias', $this->headers)
            ->assertOk()->assertJsonPath('data.0.nome', 'Sucos');
        $this->assertDatabaseHas('produto', ['id_produto' => 1, 'id_categoria' => 1]);
    }

    public function test_valida_nome_e_impede_alterar_categoria_de_outra_empresa(): void
    {
        $this->patchJson('/api/admin/categorias/1', ['nome' => ''], $this->headers)
            ->assertUnprocessable()->assertJsonValidationErrors('nome');
        $this->patchJson('/api/admin/categorias/1', ['nome' => str_repeat('a', 101)], $this->headers)
            ->assertUnprocessable()->assertJsonValidationErrors('nome');
        $this->patchJson('/api/admin/categorias/2', ['nome' => 'Alterada'], $this->headers)->assertNotFound();
        $this->patchJson('/api/admin/categorias/999', ['nome' => 'Alterada'], $this->headers)->assertNotFound();
        $this->patchJson('/api/admin/categorias/1', ['nome' => 'Alterada'])->assertUnauthorized();
        $this->assertDatabaseHas('categoria', ['id_categoria' => 1, 'nm_categoria' => 'Bebidas']);
        $this->assertDatabaseHas('categoria', ['id_categoria' => 2, 'nm_categoria' => 'Outra']);
    }
}
