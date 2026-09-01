<?php

namespace App\Services\WhatsApp;

use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\WhatsappInstance;
use App\Models\WhatsappMensagem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Orquestra a integracao WhatsApp por empresa: decide qual instancia da Evolution API
 * pertence a qual empresa, persiste o estado da conexao em `whatsapp_instancia` e concentra
 * o envio/recebimento de mensagens. Controllers (Admin e Webhook) so falam com esta classe -
 * nunca com EvolutionApiService diretamente, pra nao espalhar regra de negocio.
 */
class WhatsAppService
{
    public function __construct(private readonly EvolutionApiService $evolution)
    {
    }

    public function instanciaDaEmpresa(Empresa $empresa): ?WhatsappInstance
    {
        return WhatsappInstance::where('id_empresa', $empresa->id_empresa)->first();
    }

    /**
     * Busca o Cliente cadastrado pelo telefone, tolerando diferenca de DDI entre as tabelas
     * (o WhatsApp sempre grava com "55" na frente - ex: 5514996111783 - mas o cadastro de
     * cliente pode ter sido feito sem DDI - ex: 14996111783). Compara pelos ultimos 11
     * digitos (DDD + numero), que e a parte que realmente identifica o telefone no Brasil.
     */
    private function buscarClientePorTelefone(string $telefone): ?Cliente
    {
        $ultimosDigitos = substr($telefone, -11);

        return Cliente::whereRaw('RIGHT(telefone, 11) = ?', [$ultimosDigitos])->first();
    }

    /**
     * Lista as conversas (1 por telefone) da instancia da empresa, com a ultima mensagem de
     * cada uma, mais recente primeiro. Usada pela tela do WhatsApp pra mostrar quem ja
     * escreveu - liga ao Cliente cadastrado (pelo telefone) quando existir, pra mostrar nome
     * em vez de so o numero.
     */
    public function conversas(Empresa $empresa): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia) {
            return [];
        }

        // 1 mensagem por telefone (a de maior id, ou seja a mais recente) - depois busca so
        // essas linhas com o relacionamento de cliente/usuario carregado.
        $idsUltimaMensagemPorTelefone = WhatsappMensagem::where('id_whatsapp_instancia', $instancia->id_whatsapp_instancia)
            ->selectRaw('MAX(id_whatsapp_mensagem) as id_whatsapp_mensagem')
            ->groupBy('telefone')
            ->pluck('id_whatsapp_mensagem');

        $pendentesPorTelefone = $this->contarPendentesPorTelefone($instancia);

        return WhatsappMensagem::with('cliente.usuario')
            ->whereIn('id_whatsapp_mensagem', $idsUltimaMensagemPorTelefone)
            ->orderByDesc('dt_mensagem')
            ->get()
            ->map(function (WhatsappMensagem $mensagem) use ($pendentesPorTelefone) {
                // Mensagens antigas podem ter ficado sem id_cliente vinculado (bug de
                // divergencia de DDI ja corrigido) - tenta de novo pelo telefone antes de
                // desistir do nome, em vez de exigir reprocessar tudo que ja foi recebido.
                $cliente = $mensagem->cliente ?? $this->buscarClientePorTelefone($mensagem->telefone);
                $pendentes = $pendentesPorTelefone[$mensagem->telefone] ?? 0;

                return [
                    'telefone' => $mensagem->telefone,
                    'nome' => $cliente?->usuario?->nm_usuario ?? $mensagem->nome_contato,
                    'ultima_mensagem' => $mensagem->conteudo,
                    'tipo' => $mensagem->tipo,
                    'direcao' => $mensagem->direcao,
                    'dt_mensagem' => $mensagem->dt_mensagem?->toIso8601String(),
                    'mensagens_pendentes' => $pendentes,
                    'nao_respondida' => $pendentes > 0,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Conta, por telefone, quantas mensagens recebidas (ENTRADA) ainda nao tiveram resposta
     * da empresa - ou seja, as mensagens recebidas depois do ultimo envio (SAIDA) nosso, ou
     * todas as recebidas caso a empresa nunca tenha respondido esse numero.
     */
    private function contarPendentesPorTelefone(WhatsappInstance $instancia): array
    {
        return WhatsappMensagem::where('id_whatsapp_instancia', $instancia->id_whatsapp_instancia)
            ->orderBy('telefone')
            ->orderBy('dt_mensagem')
            ->get(['telefone', 'direcao'])
            ->groupBy('telefone')
            ->map(function ($mensagensDoTelefone) {
                // Percorre da mais recente pra mais antiga contando ENTRADA ate achar a
                // primeira SAIDA (a partir dai ja foi respondido).
                $pendentes = 0;
                foreach ($mensagensDoTelefone->reverse() as $mensagem) {
                    if ($mensagem->direcao === 'SAIDA') {
                        break;
                    }
                    $pendentes++;
                }

                return $pendentes;
            })
            ->all();
    }

    /**
     * Historico completo de mensagens trocadas com um numero especifico, mais antiga
     * primeiro (ordem de leitura de chat). Usado pela tela de Conversas ao abrir um contato.
     */
    public function mensagensDoTelefone(Empresa $empresa, string $telefone): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia) {
            return [];
        }

        $numero = $this->normalizarTelefone($telefone);
        $nomeCliente = $this->buscarClientePorTelefone($numero)?->usuario?->nm_usuario;

        $mensagens = WhatsappMensagem::where('id_whatsapp_instancia', $instancia->id_whatsapp_instancia)
            ->where('telefone', $numero)
            ->orderBy('dt_mensagem')
            ->get();

        // Fallback pro pushName mais recente entre as mensagens (o nome exibido no
        // WhatsApp pode ter sido salvo em qualquer uma delas), quando nao ha Cliente cadastrado.
        $nome = $nomeCliente ?? $mensagens->last(fn ($m) => $m->nome_contato)?->nome_contato;

        return $mensagens
            ->map(fn (WhatsappMensagem $mensagem) => [
                'id' => $mensagem->id_whatsapp_mensagem,
                'nome' => $nome,
                'conteudo' => $mensagem->conteudo,
                'tipo' => $mensagem->tipo,
                'direcao' => $mensagem->direcao,
                'status_envio' => $mensagem->status_envio,
                'dt_mensagem' => $mensagem->dt_mensagem?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /** Envio manual disparado pelo atendente na tela de Conversas (nao automatico). */
    public function enviarMensagemManual(Empresa $empresa, string $telefone, string $mensagem): array
    {
        if (trim($mensagem) === '') {
            throw new EvolutionApiException('Mensagem nao pode ser vazia.');
        }

        if (!$this->sendMessage($empresa, $telefone, $mensagem)) {
            throw new EvolutionApiException('Nao foi possivel enviar a mensagem. Verifique se o WhatsApp esta conectado.');
        }

        return $this->mensagensDoTelefone($empresa, $telefone);
    }

    /**
     * Cria a instancia na Evolution API pra essa empresa (se ainda nao existir) e devolve o
     * estado atual + QR Code inicial (quando a Evolution ja devolve um na criacao).
     */
    public function criarInstancia(Empresa $empresa): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if ($instancia) {
            return $this->status($empresa);
        }

        $nomeInstancia = $this->gerarNomeInstancia($empresa);
        $webhookUrl = $this->webhookUrl();

        $resposta = $this->evolution->criarInstancia($nomeInstancia, $webhookUrl);

        $instancia = WhatsappInstance::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_instancia' => $nomeInstancia,
            'token_instancia' => $resposta['hash'] ?? null,
            'status_conexao' => $this->extrairEstado($resposta['instance'] ?? []) ?? 'close',
            'fl_webhook_configurado' => (bool) $webhookUrl,
        ]);

        return $this->toPublic($instancia, $resposta['qrcode'] ?? null);
    }

    /** Consulta o status atual na Evolution API e sincroniza o registro local. */
    public function status(Empresa $empresa): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia) {
            return ['existe' => false, 'status' => 'inexistente'];
        }

        try {
            $resposta = $this->evolution->status($instancia->nm_instancia);
            $estado = $this->extrairEstado($resposta['instance'] ?? []);
            if ($estado) {
                $this->atualizarStatus($instancia, $estado);
            }
        } catch (Throwable $e) {
            // Evolution fora do ar ou instancia removida la sem o backend saber - devolve o
            // ultimo estado conhecido em vez de quebrar a tela.
            Log::warning('Falha ao consultar status da instancia WhatsApp.', [
                'instancia' => $instancia->nm_instancia,
                'erro' => $e->getMessage(),
            ]);
        }

        return $this->toPublic($instancia->fresh());
    }

    /** Gera (ou renova) o QR Code pra parear o WhatsApp. So funciona com a instancia fechada. */
    public function gerarQrCode(Empresa $empresa): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia) {
            throw new EvolutionApiException('Nenhuma instancia criada para esta empresa ainda.');
        }

        $resposta = $this->evolution->conectar($instancia->nm_instancia);

        $estado = $this->extrairEstado($resposta['instance'] ?? $resposta ?? []);
        if ($estado) {
            $this->atualizarStatus($instancia, $estado);
        }

        return $this->toPublic($instancia->fresh(), $resposta['qrcode'] ?? $resposta ?? null);
    }

    public function desconectar(Empresa $empresa): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia) {
            throw new EvolutionApiException('Nenhuma instancia criada para esta empresa ainda.');
        }

        $this->evolution->desconectar($instancia->nm_instancia);
        $instancia->update([
            'status_conexao' => 'close',
            'nr_telefone' => null,
            'dt_conectado' => null,
        ]);

        return $this->toPublic($instancia->fresh());
    }

    /** Reconecta uma instancia existente: reinicia se estiver aberta/conectando, ou gera QR Code novo se estiver fechada. */
    public function reconectar(Empresa $empresa): array
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia) {
            throw new EvolutionApiException('Nenhuma instancia criada para esta empresa ainda.');
        }

        if ($instancia->status_conexao === 'close') {
            return $this->gerarQrCode($empresa);
        }

        $resposta = $this->evolution->reiniciar($instancia->nm_instancia);
        $estado = $this->extrairEstado($resposta['instance'] ?? []);
        if ($estado) {
            $this->atualizarStatus($instancia, $estado);
        }

        return $this->toPublic($instancia->fresh());
    }

    /**
     * Envio reutilizavel de mensagem de texto, usado tanto por acoes manuais quanto pelas
     * futuras automacoes de pedido (confirmado, saiu pra entrega etc). Nunca deixa uma falha
     * de envio (WhatsApp desconectado, numero invalido, Evolution fora do ar) quebrar quem
     * chamou - so retorna false e loga.
     */
    public function sendMessage(Empresa $empresa, string $telefone, string $mensagem): bool
    {
        $instancia = $this->instanciaDaEmpresa($empresa);
        if (!$instancia || !$instancia->conectada()) {
            Log::warning('Tentativa de enviar WhatsApp sem instancia conectada.', [
                'id_empresa' => $empresa->id_empresa,
            ]);

            return false;
        }

        $numero = $this->normalizarTelefone($telefone);

        try {
            $resposta = $this->evolution->enviarTexto($instancia->nm_instancia, $numero, $mensagem);

            WhatsappMensagem::create([
                'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
                'id_cliente' => $this->buscarClientePorTelefone($numero)?->id_cliente,
                'direcao' => 'SAIDA',
                'telefone' => $numero,
                'conteudo' => $mensagem,
                'tipo' => 'texto',
                'id_externo' => $resposta['key']['id'] ?? null,
                'status_envio' => 'ENVIADO',
                'dt_mensagem' => now(),
            ]);

            return true;
        } catch (Throwable $e) {
            Log::warning('Falha ao enviar mensagem via WhatsApp.', [
                'id_empresa' => $empresa->id_empresa,
                'telefone' => $numero,
                'erro' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Confere se o "apikey" enviado no corpo do webhook bate com o token da instancia
     * (a Evolution API manda o token/hash proprio de CADA instancia no campo apikey do
     * webhook, nao a chave global de admin - ver instance.controller.ts::createInstance).
     */
    public function validarWebhook(string $nomeInstancia, string $apikey): bool
    {
        $instancia = WhatsappInstance::where('nm_instancia', $nomeInstancia)->first();
        if (!$instancia || !$instancia->token_instancia || !$apikey) {
            return false;
        }

        return hash_equals($instancia->token_instancia, $apikey);
    }

    /**
     * Ponto de entrada dos eventos recebidos via Webhook (EvolutionWebhookController).
     * Resolve instancia -> empresa e trata so o necessario pra deixar a arquitetura pronta
     * pra futuras automacoes, sem montar um chatbot completo agora.
     */
    public function processarWebhookEvent(string $nomeInstancia, string $event, array $data): void
    {
        $instancia = WhatsappInstance::where('nm_instancia', $nomeInstancia)->first();
        if (!$instancia) {
            Log::warning('Webhook da Evolution API recebido para instancia desconhecida.', [
                'instancia' => $nomeInstancia,
                'event' => $event,
            ]);

            return;
        }

        match ($event) {
            'connection.update' => $this->tratarAtualizacaoConexao($instancia, $data),
            'messages.upsert' => $this->tratarMensagensRecebidas($instancia, $data),
            'messages.update' => $this->tratarAtualizacaoStatusMensagem($instancia, $data),
            default => null, // qrcode.updated, send.message etc: sem processamento por enquanto.
        };
    }

    private function tratarAtualizacaoConexao(WhatsappInstance $instancia, array $data): void
    {
        $estado = $this->extrairEstado($data);
        if ($estado) {
            $this->atualizarStatus($instancia, $estado);
        }
    }

    private function tratarMensagensRecebidas(WhatsappInstance $instancia, array $data): void
    {
        // A Evolution manda um objeto de mensagem por chamada (as vezes dentro de
        // "messages": [...]) - trata os dois formatos pra nao depender de uma unica versao.
        $mensagens = $data['messages'] ?? [$data];

        foreach ($mensagens as $mensagem) {
            $this->registrarMensagem($instancia, $mensagem);
        }
    }

    private function registrarMensagem(WhatsappInstance $instancia, array $mensagem): void
    {
        $remoteJid = $mensagem['key']['remoteJid'] ?? null;
        if (!$remoteJid || str_contains($remoteJid, '@g.us')) {
            return; // Sem remetente identificavel ou mensagem de grupo - fora de escopo por enquanto.
        }

        $telefone = $this->normalizarTelefone($remoteJid);
        $fromMe = (bool) ($mensagem['key']['fromMe'] ?? false);
        $texto = $mensagem['message']['conversation']
            ?? $mensagem['message']['extendedTextMessage']['text']
            ?? null;

        // pushName e o nome que o contato configurou no proprio WhatsApp (so vem em
        // mensagens recebidas, nunca nas que a propria empresa envia) - guarda pra usar
        // como fallback de exibicao quando o telefone nao bate com nenhum Cliente cadastrado.
        $pushName = !$fromMe ? ($mensagem['pushName'] ?? null) : null;

        WhatsappMensagem::create([
            'id_whatsapp_instancia' => $instancia->id_whatsapp_instancia,
            'id_cliente' => $this->buscarClientePorTelefone($telefone)?->id_cliente,
            'direcao' => $fromMe ? 'SAIDA' : 'ENTRADA',
            'telefone' => $telefone,
            'nome_contato' => $pushName,
            'conteudo' => $texto,
            'tipo' => $mensagem['messageType'] ?? 'texto',
            'id_externo' => $mensagem['key']['id'] ?? null,
            'status_envio' => $fromMe ? 'ENVIADO' : 'RECEBIDO',
            'dt_mensagem' => !empty($mensagem['messageTimestamp'])
                // O 2o parametro (timezone) e essencial: sem ele, createFromTimestamp cria o
                // Carbon em UTC (diferente de now(), que respeita config('app.timezone')) - a
                // combinacao com a coluna sendo naive (sem tz no MySQL) fazia o horario
                // gravado ficar "adiantado" pelo offset entre UTC e America/Sao_Paulo.
                ? Carbon::createFromTimestamp((int) $mensagem['messageTimestamp'], config('app.timezone'))
                : now(),
        ]);
    }

    private function tratarAtualizacaoStatusMensagem(WhatsappInstance $instancia, array $data): void
    {
        $idExterno = $data['keyId'] ?? $data['key']['id'] ?? null;
        $novoStatus = $data['status'] ?? null;
        if (!$idExterno || !$novoStatus) {
            return;
        }

        WhatsappMensagem::where('id_whatsapp_instancia', $instancia->id_whatsapp_instancia)
            ->where('id_externo', $idExterno)
            ->update(['status_envio' => $novoStatus]);
    }

    private function atualizarStatus(WhatsappInstance $instancia, string $estado): void
    {
        $dados = ['status_conexao' => $estado];

        if ($estado === 'open' && !$instancia->conectada()) {
            $dados['dt_conectado'] = now();
        }
        if ($estado === 'open' && !$instancia->nr_telefone) {
            $dados['nr_telefone'] = $this->buscarNumeroConectado($instancia->nm_instancia);
        }
        if ($estado !== 'open') {
            $dados['nr_telefone'] = null;
        }

        $instancia->update($dados);
    }

    /**
     * O endpoint de status simples nao devolve o numero conectado (so o "state") - precisa
     * buscar os detalhes completos da instancia pra pegar o `ownerJid`. So roda uma vez (ate
     * o numero ficar salvo), nao a cada poll de status.
     */
    private function buscarNumeroConectado(string $nomeInstancia): ?string
    {
        try {
            $detalhes = $this->evolution->buscarInstancia($nomeInstancia);
            $ownerJid = $detalhes['ownerJid'] ?? null;

            return $ownerJid ? $this->normalizarTelefone($ownerJid) : null;
        } catch (Throwable $e) {
            Log::warning('Falha ao buscar numero conectado da instancia WhatsApp.', [
                'instancia' => $nomeInstancia,
                'erro' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function extrairEstado(array $instanceData): ?string
    {
        return $instanceData['state'] ?? $instanceData['status'] ?? $instanceData['connectionStatus'] ?? null;
    }

    /** Nome estavel e unico na Evolution API - nunca muda depois de criado. */
    private function gerarNomeInstancia(Empresa $empresa): string
    {
        return 'empresa-' . $empresa->id_empresa . '-' . Str::slug($empresa->nm_empresa);
    }

    private function webhookUrl(): ?string
    {
        return config('services.evolution.webhook_url') ?: rtrim(config('app.url'), '/') . '/api/webhooks/evolution';
    }

    /** Aceita numero puro ou remoteJid (5511999999999@s.whatsapp.net) e devolve so digitos. */
    private function normalizarTelefone(string $numero): string
    {
        $semSufixo = Str::before($numero, '@');
        $digitos = preg_replace('/\D/', '', $semSufixo);

        if (strlen($digitos) <= 11) {
            $digitos = '55' . $digitos;
        }

        return $digitos;
    }

    private function toPublic(WhatsappInstance $instancia, ?array $qrcode = null): array
    {
        return [
            'existe' => true,
            'instancia' => $instancia->nm_instancia,
            'status' => $instancia->status_conexao,
            'conectado' => $instancia->conectada(),
            'numero' => $instancia->nr_telefone,
            'dt_conectado' => $instancia->dt_conectado?->toIso8601String(),
            'qrcode' => $qrcode['base64'] ?? null,
        ];
    }
}
