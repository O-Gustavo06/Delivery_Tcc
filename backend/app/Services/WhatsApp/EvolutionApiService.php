<?php

namespace App\Services\WhatsApp;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Camada fina de comunicacao HTTP com a Evolution API (v2.3.7 - ver /evolution-api na raiz
 * do projeto). Nao conhece "Empresa", "Pedido" nem nada do dominio do restaurante - so fala
 * a "lingua" da Evolution API (endpoints, headers, formato de payload). Quem decide qual
 * instancia usar pra qual empresa e o WhatsAppService.
 *
 * Endpoints confirmados lendo o codigo fonte local (evolution-api/src/api/routes e
 * /controllers), nao documentacao externa:
 * - POST   /instance/create
 * - GET    /instance/connect/{instance}
 * - GET    /instance/connectionState/{instance}
 * - POST   /instance/restart/{instance}
 * - DELETE /instance/logout/{instance}
 * - DELETE /instance/delete/{instance}
 * - POST   /message/sendText/{instance}
 * - POST   /webhook/set/{instance}
 */
class EvolutionApiService
{
    /** Eventos que o backend sabe processar (ver EvolutionWebhookController). */
    public const EVENTOS_WEBHOOK = [
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'SEND_MESSAGE',
    ];

    public function configurado(): bool
    {
        return filled(config('services.evolution.base_url')) && filled(config('services.evolution.api_key'));
    }

    /**
     * Cria a instancia na Evolution API ja com o webhook configurado e pedindo o QR Code
     * de cara (integration WHATSAPP-BAILEYS - o unico modo suportado aqui, sem WhatsApp
     * Business API nem Chatwoot).
     */
    public function criarInstancia(string $instanceName, ?string $webhookUrl): array
    {
        $payload = [
            'instanceName' => $instanceName,
            'qrcode' => true,
            'integration' => 'WHATSAPP-BAILEYS',
        ];

        if ($webhookUrl) {
            $payload['webhook'] = $this->webhookPayload($webhookUrl);
        }

        return $this->request()->post('/instance/create', $payload)->json();
    }

    /** Busca/gera um novo QR Code. So retorna algo util quando o estado for "close". */
    public function conectar(string $instanceName): array
    {
        return $this->request()->get("/instance/connect/{$instanceName}")->json();
    }

    public function status(string $instanceName): array
    {
        return $this->request()->get("/instance/connectionState/{$instanceName}")->json();
    }

    /**
     * Detalhes completos da instancia (inclui `ownerJid`, o numero conectado no formato
     * "5511999999999@s.whatsapp.net") - o endpoint de status simples nao devolve isso.
     */
    public function buscarInstancia(string $instanceName): ?array
    {
        $instancias = $this->request()->get('/instance/fetchInstances', ['instanceName' => $instanceName])->json();

        return $instancias[0] ?? null;
    }

    public function reiniciar(string $instanceName): array
    {
        return $this->request()->post("/instance/restart/{$instanceName}")->json();
    }

    public function desconectar(string $instanceName): array
    {
        return $this->request()->delete("/instance/logout/{$instanceName}")->json();
    }

    public function excluirInstancia(string $instanceName): array
    {
        return $this->request()->delete("/instance/delete/{$instanceName}")->json();
    }

    /** @param string $numero Somente digitos, com DDI (ex: 5511999999999). */
    public function enviarTexto(string $instanceName, string $numero, string $texto): array
    {
        return $this->request()->post("/message/sendText/{$instanceName}", [
            'number' => $numero,
            'text' => $texto,
        ])->json();
    }

    public function configurarWebhook(string $instanceName, string $webhookUrl): array
    {
        return $this->request()->post("/webhook/set/{$instanceName}", [
            'webhook' => $this->webhookPayload($webhookUrl),
        ])->json();
    }

    private function webhookPayload(string $webhookUrl): array
    {
        return [
            'url' => $webhookUrl,
            'enabled' => true,
            'byEvents' => false,
            'base64' => true,
            'events' => self::EVENTOS_WEBHOOK,
        ];
    }

    /**
     * PendingRequest configurado com base_url/apikey/timeout e "throw automatico" em
     * resposta de erro (4xx/5xx vira RequestException, logada antes de subir - quem chamar
     * decide se recupera com try/catch ou deixa estourar).
     */
    private function request(): PendingRequest
    {
        if (!$this->configurado()) {
            throw new EvolutionApiException('Evolution API nao configurada (EVOLUTION_API_URL/EVOLUTION_API_KEY).');
        }

        return Http::baseUrl(rtrim(config('services.evolution.base_url'), '/'))
            ->withHeaders(['apikey' => config('services.evolution.api_key')])
            ->timeout(15)
            ->throw(function ($response, RequestException $e) {
                Log::warning('Evolution API retornou erro.', [
                    'status' => $response->status(),
                    'body' => $response->json() ?? $response->body(),
                ]);
            });
    }
}
