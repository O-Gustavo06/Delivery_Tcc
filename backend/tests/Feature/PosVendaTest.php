<?php

namespace Tests\Feature;

use App\Jobs\EnviarPesquisaPosVenda;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Pedido;
use App\Models\PosVenda;
use App\Models\WhatsappInstance;
use App\Models\WhatsappMensagem;
use App\Services\ClienteIdentityService;
use App\Services\PosVendaService;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\CriaDadosBasicos;
use Tests\TestCase;

class PosVendaTest extends TestCase
{
    use CriaDadosBasicos;

    public function test_numeros_com_formatos_diferentes_reutilizam_o_mesmo_cliente(): void
    {
        $cliente = Cliente::create([
            'id_usuario' => $this->criarUsuario('CLIENTE')->id_usuario,
            'telefone' => '(11) 98888-7777',
        ]);

        $encontrado = app(ClienteIdentityService::class)
            ->buscarOuCriar('Nome alternativo', '+55 11 98888-7777');

        $this->assertSame($cliente->id_cliente, $encontrado->id_cliente);
        $this->assertSame('5511988887777', $encontrado->telefone_normalizado);
    }

    public function test_pesquisa_de_pedido_e_agendada_uma_vez_com_o_atraso_configurado(): void
    {
        Queue::fake();
        config(['services.pos_venda.delay_minutes' => 0]);
        [$pedido] = $this->pedidoConcluido();
        $service = app(PosVendaService::class);

        $pesquisa = $service->agendarPedido($pedido);
        $repetida = $service->agendarPedido($pedido);

        $this->assertSame($pesquisa->id_pos_venda, $repetida->id_pos_venda);
        $this->assertSame('AGENDADA', $pesquisa->status);
        $this->assertTrue($pesquisa->dt_envio_previsto->between(now()->subSecond(), now()->addSecond()));
        Queue::assertPushedOn('whatsapp', EnviarPesquisaPosVenda::class);
        $this->assertCount(1, Queue::pushed(EnviarPesquisaPosVenda::class));
    }

    public function test_resposta_de_nota_fica_vinculada_a_pesquisa_cliente_e_pedido(): void
    {
        [$pedido, $cliente, $empresa] = $this->pedidoConcluido();
        $pesquisa = PosVenda::create([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $cliente->id_cliente,
            'telefone' => $cliente->telefone_normalizado,
            'status' => 'ENVIADA',
            'dt_enviado' => now(),
        ]);
        $instancia = WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => 'empresa-' . $empresa->id_empresa . '-teste',
            'status_conexao' => 'open',
            'token_instancia' => 'token-pos-venda',
        ]);
        $mensagem = WhatsappMensagem::create([
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'id_cliente' => $cliente->id_cliente,
            'direcao' => 'ENTRADA',
            'telefone' => $cliente->telefone_normalizado,
            'conteudo' => '5',
            'tipo' => 'texto',
            'status_envio' => 'RECEBIDO',
            'dt_mensagem' => now(),
        ]);

        app(PosVendaService::class)->registrarResposta($mensagem);

        $this->assertDatabaseHas('pos_venda', [
            'id_pos_venda' => $pesquisa->id_pos_venda,
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $cliente->id_cliente,
            'nota' => 5,
            'status' => 'RESPONDIDA',
        ]);
        $this->assertSame($pesquisa->id_pos_venda, $mensagem->fresh()->id_pos_venda);
    }

    private function pedidoConcluido(): array
    {
        $empresa = $this->criarEmpresa();
        $cliente = Cliente::create([
            'id_usuario' => $this->criarUsuario('CLIENTE')->id_usuario,
            'telefone' => '11900001111',
        ]);
        $pedido = Pedido::create([
            'id_empresa' => $empresa->id_empresa,
            'id_cliente' => $cliente->id_cliente,
            'codigo_qr' => (string) \Illuminate\Support\Str::uuid(),
            'tipo_pedido' => 'DELIVERY',
            'canal_origem' => 'ONLINE',
            'status' => 'FINALIZADO',
            'vl_total' => 35,
            'vl_taxa_entrega' => 0,
        ]);

        return [$pedido, $cliente, $empresa];
    }
}
