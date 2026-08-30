<?php

namespace Tests\Feature;

use App\Models\WhatsappInstance;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class AdminWhatsAppTest extends TestCase
{
    use CriaDadosBasicos;

    private function headers(): array
    {
        [, $token] = $this->criarAdminComToken();

        return ['Authorization' => 'Bearer ' . $token];
    }

    private function configurarEvolutionFake(array $respostas): void
    {
        config([
            'services.evolution.base_url' => 'http://evolution-api.test',
            'services.evolution.api_key' => 'chave-de-teste',
        ]);

        Http::fake($respostas);
    }

    public function test_status_sem_instancia_criada_retorna_existe_false(): void
    {
        $this->criarEmpresa();

        $response = $this->getJson('/api/admin/whatsapp/status', $this->headers());

        $response->assertOk()->assertJson(['existe' => false, 'status' => 'inexistente']);
    }

    public function test_rotas_de_whatsapp_exigem_autenticacao(): void
    {
        $this->getJson('/api/admin/whatsapp/status')->assertStatus(401);
    }

    public function test_criar_instancia_persiste_registro_e_devolve_qrcode(): void
    {
        $empresa = $this->criarEmpresa(['nm_empresa' => 'Pizzaria Teste']);

        $this->configurarEvolutionFake([
            'evolution-api.test/instance/create' => Http::response([
                'instance' => ['instanceName' => 'empresa-' . $empresa->id_empresa . '-pizzaria-teste', 'status' => 'connecting'],
                'hash' => 'token-abc',
                'qrcode' => ['base64' => 'data:image/png;base64,FAKE'],
            ], 201),
        ]);

        $response = $this->postJson('/api/admin/whatsapp/instancia', [], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('existe', true)
            ->assertJsonPath('status', 'connecting')
            ->assertJsonPath('qrcode', 'data:image/png;base64,FAKE');

        $this->assertDatabaseHas('whatsapp_instancia', [
            'id_empresa' => $empresa->id_empresa,
            'status_conexao' => 'connecting',
            'fl_webhook_configurado' => true,
        ]);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/instance/create')
                && $request['webhook']['events'] === \App\Services\WhatsApp\EvolutionApiService::EVENTOS_WEBHOOK;
        });
    }

    public function test_criar_instancia_e_idempotente_quando_ja_existe(): void
    {
        $empresa = $this->criarEmpresa();
        $instancia = WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'open',
            'nr_telefone' => '5511999999999',
        ]);

        $this->configurarEvolutionFake([
            'evolution-api.test/instance/connectionState/*' => Http::response([
                'instance' => ['instanceName' => $instancia->nm_instancia, 'state' => 'open'],
            ], 200),
        ]);

        $response = $this->postJson('/api/admin/whatsapp/instancia', [], $this->headers());

        $response->assertStatus(201)->assertJsonPath('status', 'open');
        $this->assertSame(1, WhatsappInstance::where('id_empresa', $empresa->id_empresa)->count());
    }

    public function test_qrcode_atualiza_status_e_devolve_base64(): void
    {
        $empresa = $this->criarEmpresa();
        $instancia = WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'close',
        ]);

        $this->configurarEvolutionFake([
            'evolution-api.test/instance/connect/*' => Http::response([
                'instance' => ['instanceName' => $instancia->nm_instancia, 'state' => 'connecting'],
                'qrcode' => ['base64' => 'data:image/png;base64,NOVO'],
            ], 200),
        ]);

        $response = $this->getJson('/api/admin/whatsapp/qrcode', $this->headers());

        $response->assertOk()->assertJsonPath('qrcode', 'data:image/png;base64,NOVO');
        $this->assertDatabaseHas('whatsapp_instancia', [
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'status_conexao' => 'connecting',
        ]);
    }

    public function test_qrcode_sem_instancia_retorna_422(): void
    {
        $this->criarEmpresa();

        $response = $this->getJson('/api/admin/whatsapp/qrcode', $this->headers());

        $response->assertStatus(422);
    }

    public function test_desconectar_limpa_numero_e_status(): void
    {
        $empresa = $this->criarEmpresa();
        $instancia = WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'open',
            'nr_telefone' => '5514',
            'dt_conectado' => now(),
        ]);

        $this->configurarEvolutionFake([
            'evolution-api.test/instance/logout/*' => Http::response(['status' => 'SUCCESS'], 200),
        ]);

        $response = $this->postJson('/api/admin/whatsapp/desconectar', [], $this->headers());

        $response->assertOk()->assertJsonPath('status', 'close')->assertJsonPath('conectado', false);
        $this->assertDatabaseHas('whatsapp_instancia', [
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'status_conexao' => 'close',
            'nr_telefone' => null,
        ]);
    }

    public function test_reconectar_gera_qrcode_quando_fechada(): void
    {
        $empresa = $this->criarEmpresa();
        WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'close',
        ]);

        $this->configurarEvolutionFake([
            'evolution-api.test/instance/connect/*' => Http::response([
                'instance' => ['state' => 'connecting'],
                'qrcode' => ['base64' => 'data:image/png;base64,RECONECTAR'],
            ], 200),
        ]);

        $response = $this->postJson('/api/admin/whatsapp/reconectar', [], $this->headers());

        $response->assertOk()->assertJsonPath('qrcode', 'data:image/png;base64,RECONECTAR');
    }

    public function test_reconectar_reinicia_quando_ja_conectada(): void
    {
        $empresa = $this->criarEmpresa();
        WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'open',
            'nr_telefone' => '5511999999999',
        ]);

        $this->configurarEvolutionFake([
            'evolution-api.test/instance/restart/*' => Http::response([
                'instance' => ['status' => 'connecting'],
            ], 200),
        ]);

        $response = $this->postJson('/api/admin/whatsapp/reconectar', [], $this->headers());

        $response->assertOk()->assertJsonPath('status', 'connecting');

        Http::assertSent(fn ($request) => str_contains($request->url(), '/instance/restart/'));
    }

    public function test_conversas_lista_apenas_ultima_mensagem_por_telefone_mais_recente_primeiro(): void
    {
        $empresa = $this->criarEmpresa();
        $instancia = WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'open',
        ]);
        $cliente = \App\Models\Cliente::create([
            'id_usuario' => $this->criarUsuario('CLIENTE', ['nm_usuario' => 'Joao da Silva'])->id_usuario,
            'telefone' => '5511988887777',
        ]);

        \App\Models\WhatsappMensagem::create([
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'id_cliente' => $cliente->id_cliente,
            'direcao' => 'ENTRADA',
            'telefone' => '5511988887777',
            'conteudo' => 'Mensagem antiga',
            'tipo' => 'conversation',
            'dt_mensagem' => now()->subHour(),
        ]);
        \App\Models\WhatsappMensagem::create([
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'id_cliente' => $cliente->id_cliente,
            'direcao' => 'ENTRADA',
            'telefone' => '5511988887777',
            'conteudo' => 'Mensagem mais recente',
            'tipo' => 'conversation',
            'dt_mensagem' => now(),
        ]);
        \App\Models\WhatsappMensagem::create([
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'direcao' => 'ENTRADA',
            'telefone' => '5511977776666',
            'conteudo' => null,
            'tipo' => 'stickerMessage',
            'dt_mensagem' => now()->subMinutes(30),
        ]);

        $response = $this->getJson('/api/admin/whatsapp/conversas', $this->headers());

        $response->assertOk();
        $data = $response->json('data');

        $this->assertCount(2, $data);
        $this->assertSame('5511988887777', $data[0]['telefone']);
        $this->assertSame('Joao da Silva', $data[0]['nome']);
        $this->assertSame('Mensagem mais recente', $data[0]['ultima_mensagem']);
        $this->assertSame('5511977776666', $data[1]['telefone']);
        $this->assertNull($data[1]['nome']);
        $this->assertSame('stickerMessage', $data[1]['tipo']);
    }

    public function test_conversas_sem_instancia_devolve_lista_vazia(): void
    {
        $this->criarEmpresa();

        $response = $this->getJson('/api/admin/whatsapp/conversas', $this->headers());

        $response->assertOk()->assertJsonPath('data', []);
    }
}
