<?php

namespace Tests\Feature;

use App\Models\Entregador;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use CriaDadosBasicos;

    public function test_login_com_credenciais_corretas_retorna_token(): void
    {
        $usuario = $this->criarUsuario('ADMIN', [
            'email' => 'joao@teste.local',
            'senha_hash' => bcrypt('senha12345'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'joao@teste.local',
            'password' => 'senha12345',
        ]);

        $response->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('user.id', $usuario->id_usuario)
            ->assertJsonPath('user.role', 'ADMIN')
            ->assertJsonStructure(['token']);
    }

    public function test_login_com_senha_errada_retorna_401(): void
    {
        $this->criarUsuario('ADMIN', [
            'email' => 'joao2@teste.local',
            'senha_hash' => bcrypt('senha12345'),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'joao2@teste.local',
            'password' => 'senha-errada',
        ])->assertStatus(401);
    }

    public function test_login_usuario_inativo_retorna_403(): void
    {
        $this->criarUsuario('ADMIN', [
            'email' => 'inativo@teste.local',
            'senha_hash' => bcrypt('senha12345'),
            'fl_ativo' => false,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'inativo@teste.local',
            'password' => 'senha12345',
        ])->assertStatus(403);
    }

    public function test_parear_com_codigo_valido_autentica_e_consome_o_codigo(): void
    {
        $entregador = $this->criarEntregador([
            'codigo_pareamento' => 'ABC12345',
            'codigo_pareamento_expira_em' => now()->addHour(),
        ]);

        $response = $this->postJson('/api/auth/parear', ['codigo' => 'abc12345']);

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonStructure(['token', 'user']);

        // Uso unico: o mesmo codigo nao deve mais funcionar.
        $this->postJson('/api/auth/parear', ['codigo' => 'ABC12345'])->assertStatus(422);

        $this->assertNull($entregador->fresh()->codigo_pareamento);
    }

    public function test_parear_com_codigo_expirado_falha(): void
    {
        $this->criarEntregador([
            'codigo_pareamento' => 'EXPIRADO1',
            'codigo_pareamento_expira_em' => now()->subMinute(),
        ]);

        $this->postJson('/api/auth/parear', ['codigo' => 'EXPIRADO1'])->assertStatus(422);
    }

    public function test_parear_com_codigo_inexistente_falha(): void
    {
        $this->postJson('/api/auth/parear', ['codigo' => Str::random(10)])->assertStatus(422);
    }

    public function test_rota_admin_exige_token(): void
    {
        $this->getJson('/api/admin/dashboard')->assertStatus(401);
    }

    public function test_rota_admin_rejeita_perfil_errado(): void
    {
        $entregador = $this->criarEntregador();
        $token = $entregador->usuario->createToken('teste')->plainTextToken;

        $this->getJson('/api/admin/dashboard', ['Authorization' => "Bearer $token"])
            ->assertStatus(403);
    }

    public function test_sessao_admin_expira_apos_uma_hora_sem_interacao_mesmo_com_consultas(): void
    {
        [, $token] = $this->criarAdminComToken();
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->travel(59)->minutes();
        $this->getJson('/api/auth/me', $headers)->assertOk();

        $this->travel(1)->minutes();
        $this->getJson('/api/auth/me', $headers)->assertUnauthorized();
        $this->assertNull(PersonalAccessToken::findToken($token));
    }

    public function test_interacao_renova_o_prazo_de_inatividade_do_admin(): void
    {
        [, $token] = $this->criarAdminComToken();
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->travel(59)->minutes();
        $this->postJson('/api/auth/activity', [], $headers)->assertNoContent();
        $this->travel(59)->minutes();
        $this->getJson('/api/auth/me', $headers)->assertOk();
        $this->travel(1)->minutes();
        $this->postJson('/api/auth/activity', [], $headers)->assertUnauthorized();
    }

    public function test_logout_revoga_o_token(): void
    {
        [, $token] = $this->criarAdminComToken();
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->postJson('/api/auth/logout', [], $headers)->assertNoContent();
        $this->assertNull(PersonalAccessToken::findToken($token));
        $this->getJson('/api/auth/me', $headers)->assertUnauthorized();
    }

    public function test_inatividade_do_admin_nao_altera_pareamento_do_entregador(): void
    {
        $entregador = $this->criarEntregador();
        $token = $entregador->usuario->createToken('teste')->plainTextToken;

        $this->travel(61)->minutes();
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer {$token}"])->assertOk();
    }
}
