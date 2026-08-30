<?php

namespace Tests\Feature;

use App\Models\WhatsappInstance;
use App\Models\WhatsappMensagem;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class EvolutionWebhookTest extends TestCase
{
    use CriaDadosBasicos;

    private const TOKEN_INSTANCIA = 'TOKEN-DE-TESTE-DA-INSTANCIA';

    /**
     * A Evolution API manda, no campo "apikey" do webhook, o token/hash proprio de CADA
     * instancia (nao a chave global de admin) - por isso toda instancia de teste ja nasce
     * com um token_instancia pra validar contra ele, igual valida a real.
     */
    private function criarInstancia(): WhatsappInstance
    {
        $empresa = $this->criarEmpresa();

        return WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'connecting',
            'token_instancia' => self::TOKEN_INSTANCIA,
        ]);
    }

    public function test_apikey_invalida_retorna_401(): void
    {
        $instancia = $this->criarInstancia();

        $response = $this->postJson('/api/webhooks/evolution', [
            'event' => 'connection.update',
            'instance' => $instancia->nm_instancia,
            'data' => ['state' => 'open'],
            'apikey' => 'chave-errada',
        ]);

        $response->assertStatus(401);
    }

    public function test_connection_update_atualiza_status_e_marca_conectado(): void
    {
        $instancia = $this->criarInstancia();

        $response = $this->postJson('/api/webhooks/evolution', [
            'event' => 'connection.update',
            'instance' => $instancia->nm_instancia,
            'data' => ['state' => 'open'],
            'apikey' => self::TOKEN_INSTANCIA,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('whatsapp_instancia', [
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'status_conexao' => 'open',
        ]);
        $this->assertNotNull($instancia->fresh()->dt_conectado);
    }

    public function test_mensagem_recebida_e_registrada_e_associada_ao_cliente(): void
    {
        $instancia = $this->criarInstancia();
        $cliente = \App\Models\Cliente::create([
            'id_usuario' => $this->criarUsuario('CLIENTE')->id_usuario,
            'telefone' => '5511988887777',
        ]);

        $response = $this->postJson('/api/webhooks/evolution', [
            'event' => 'messages.upsert',
            'instance' => $instancia->nm_instancia,
            'data' => [
                'key' => ['remoteJid' => '5511988887777@s.whatsapp.net', 'fromMe' => false, 'id' => 'MSG123'],
                'pushName' => 'Cliente Teste',
                'message' => ['conversation' => 'Oi, quero fazer um pedido'],
                'messageType' => 'conversation',
            ],
            'apikey' => self::TOKEN_INSTANCIA,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('whatsapp_mensagem', [
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'id_cliente' => $cliente->id_cliente,
            'direcao' => 'ENTRADA',
            'telefone' => '5511988887777',
            'conteudo' => 'Oi, quero fazer um pedido',
            'id_externo' => 'MSG123',
        ]);
    }

    public function test_dt_mensagem_do_messageTimestamp_respeita_o_timezone_da_aplicacao(): void
    {
        // Regressao: Carbon::createFromTimestamp() sem o 2o parametro cria o horario em UTC
        // (diferente de now(), que ja usa America/Sao_Paulo) - isso fazia a mensagem ficar
        // gravada com o horario "adiantado" pelo offset entre UTC e o horario de Brasilia.
        $instancia = $this->criarInstancia();
        $timestampUnix = now()->getTimestamp();

        $this->postJson('/api/webhooks/evolution', [
            'event' => 'messages.upsert',
            'instance' => $instancia->nm_instancia,
            'data' => [
                'key' => ['remoteJid' => '5511988887777@s.whatsapp.net', 'fromMe' => false, 'id' => 'MSG_TZ'],
                'message' => ['conversation' => 'Teste de timezone'],
                'messageType' => 'conversation',
                'messageTimestamp' => $timestampUnix,
            ],
            'apikey' => self::TOKEN_INSTANCIA,
        ])->assertOk();

        $mensagem = WhatsappMensagem::where('id_externo', 'MSG_TZ')->firstOrFail();

        $this->assertEqualsWithDelta($timestampUnix, $mensagem->dt_mensagem->getTimestamp(), 2);
    }

    public function test_mensagem_de_grupo_e_ignorada(): void
    {
        $instancia = $this->criarInstancia();

        $response = $this->postJson('/api/webhooks/evolution', [
            'event' => 'messages.upsert',
            'instance' => $instancia->nm_instancia,
            'data' => [
                'key' => ['remoteJid' => '123456-group@g.us', 'fromMe' => false, 'id' => 'MSG999'],
                'message' => ['conversation' => 'mensagem de grupo'],
            ],
            'apikey' => self::TOKEN_INSTANCIA,
        ]);

        $response->assertOk();
        $this->assertDatabaseMissing('whatsapp_mensagem', ['id_externo' => 'MSG999']);
    }

    public function test_instancia_desconhecida_retorna_401(): void
    {
        // Sem a instancia cadastrada nao ha token pra validar contra - a unica postura
        // segura e negar, nunca processar um evento que nao da pra autenticar.
        $response = $this->postJson('/api/webhooks/evolution', [
            'event' => 'connection.update',
            'instance' => 'instancia-que-nao-existe',
            'data' => ['state' => 'open'],
            'apikey' => 'qualquer-coisa',
        ]);

        $response->assertStatus(401);
    }

    public function test_messages_update_atualiza_status_de_envio_da_mensagem_existente(): void
    {
        $instancia = $this->criarInstancia();
        $mensagem = WhatsappMensagem::create([
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'direcao' => 'SAIDA',
            'telefone' => '5511988887777',
            'conteudo' => 'Seu pedido foi confirmado',
            'id_externo' => 'MSG555',
            'status_envio' => 'ENVIADO',
            'dt_mensagem' => now(),
        ]);

        $response = $this->postJson('/api/webhooks/evolution', [
            'event' => 'messages.update',
            'instance' => $instancia->nm_instancia,
            'data' => ['keyId' => 'MSG555', 'status' => 'DELIVERY_ACK'],
            'apikey' => self::TOKEN_INSTANCIA,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('whatsapp_mensagem', [
            'id_whatsapp_mensagem' => $mensagem->id_whatsapp_mensagem,
            'status_envio' => 'DELIVERY_ACK',
        ]);
    }
}
