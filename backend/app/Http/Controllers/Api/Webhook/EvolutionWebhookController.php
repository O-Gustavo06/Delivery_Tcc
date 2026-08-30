<?php

namespace App\Http\Controllers\Api\Webhook;

use App\Http\Controllers\Controller;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Recebe os eventos que a Evolution API envia (mensagem recebida/enviada, atualizacao de
 * conexao etc). Rota publica (a Evolution API nao manda Bearer token de usuario), protegida
 * validando o campo "apikey" que ela mesma inclui em todo payload contra a chave configurada.
 *
 * Payload (confirmado lendo evolution-api/src/api/integrations/event/webhook/webhook.controller.ts):
 * { event, instance, data, destination, date_time, sender, server_url, apikey }
 */
class EvolutionWebhookController extends Controller
{
    public function __construct(private readonly WhatsAppService $whatsApp)
    {
    }

    public function handle(Request $request): JsonResponse
    {
        $instance = $request->string('instance')->toString();
        $event = $request->string('event')->toString();
        $data = (array) $request->input('data', []);
        $apikey = (string) $request->input('apikey', '');

        if (!$instance || !$event) {
            return response()->json(['message' => 'Payload invalido.'], 422);
        }

        if (!$this->whatsApp->validarWebhook($instance, $apikey)) {
            return response()->json(['message' => 'Nao autorizado.'], 401);
        }

        try {
            $this->whatsApp->processarWebhookEvent($instance, $event, $data);
        } catch (\Throwable $e) {
            // Nunca devolve erro pra Evolution API por causa de uma falha ao processar - ela
            // reinterpreta erro como "reentregar depois" (retry), o que so acumula ruido.
            Log::error('Falha ao processar webhook da Evolution API.', [
                'instance' => $instance,
                'event' => $event,
                'erro' => $e->getMessage(),
            ]);
        }

        return response()->json(['message' => 'ok']);
    }
}
