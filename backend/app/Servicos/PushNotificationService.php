<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * Notificacao push real de mudanca de status do pedido (delivery/balcao online), via Web
 * Push padrao do navegador (Notifications API + Service Worker), sem depender de nenhum
 * app nativo ou servico de terceiro alem do proprio navegador do cliente.
 */
class PushNotificationService
{
    private const STATUS_MENSAGEM = [
        'CONFIRMADO' => 'Pedido aceito e já está sendo preparado!',
        'PREPARANDO' => 'Sua comida está sendo preparada.',
        'PRONTO' => 'Pedido pronto!',
        'ENTREGANDO' => 'Saiu para entrega — o motoboy está a caminho.',
        'FINALIZADO' => 'Pedido entregue. Bom apetite!',
        'CANCELADO' => 'Seu pedido foi cancelado.',
    ];

    public function configurado(): bool
    {
        return filled(config('services.vapid.public_key')) && filled(config('services.vapid.private_key'));
    }

    /**
     * Notifica todo mundo inscrito pra acompanhar esse pedido (normalmente um so navegador,
     * mas nada impede o cliente ter aberto o link de acompanhamento em mais de um lugar).
     * Nunca deixa uma falha de envio (chave invalida, endpoint fora do ar, timeout etc.)
     * quebrar quem chamou - isso e so um aviso, a mudanca de status do pedido ja aconteceu
     * de verdade antes disso e nao pode ser derrubada por causa de notificacao.
     */
    public function notificarMudancaDeStatus(Pedido $pedido): void
    {
        if (!$this->configurado()) {
            return;
        }

        $mensagem = self::STATUS_MENSAGEM[$pedido->status] ?? null;
        if (!$mensagem) {
            return;
        }

        try {
            $inscricoes = PushSubscription::where('id_pedido', $pedido->id_pedido)->get();
            if ($inscricoes->isEmpty()) {
                return;
            }

            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('services.vapid.subject'),
                    'publicKey' => config('services.vapid.public_key'),
                    'privateKey' => config('services.vapid.private_key'),
                ],
            ]);

            $rotulo = $pedido->tipo_pedido === 'BALCAO' ? 'Retirada no balcão' : 'Pedido delivery';
            $payload = json_encode([
                'titulo' => $rotulo . ' #' . ($pedido->nr_pedido_delivery ?? $pedido->id_pedido),
                'corpo' => $mensagem,
                'url' => '/cardapio/pedir',
            ]);

            foreach ($inscricoes as $inscricao) {
                try {
                    $subscription = Subscription::create([
                        'endpoint' => $inscricao->endpoint,
                        'publicKey' => $inscricao->chave_p256dh,
                        'authToken' => $inscricao->chave_auth,
                    ]);

                    $webPush->queueNotification($subscription, $payload);
                } catch (Throwable $e) {
                    // Chave/endpoint com formato invalido - descarta so essa inscricao e
                    // segue notificando as outras.
                    Log::warning('Falha ao preparar push notification', ['erro' => $e->getMessage()]);
                }
            }

            foreach ($webPush->flush() as $report) {
                // Endpoint expirado/revogado (cliente desinstalou, trocou de navegador etc.) -
                // remove a inscricao morta em vez de tentar mandar pra ela pra sempre.
                if (!$report->isSuccess() && $report->isSubscriptionExpired()) {
                    PushSubscription::where('endpoint', $report->getEndpoint())->delete();
                }
            }
        } catch (Throwable $e) {
            Log::warning('Falha ao enviar push notification de status do pedido', [
                'id_pedido' => $pedido->id_pedido,
                'erro' => $e->getMessage(),
            ]);
        }
    }
}
