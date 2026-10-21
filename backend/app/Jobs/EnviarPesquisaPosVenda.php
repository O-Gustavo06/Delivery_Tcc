<?php

namespace App\Jobs;

use App\Models\Empresa;
use App\Models\PosVenda;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class EnviarPesquisaPosVenda implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $idPosVenda)
    {
        $this->onQueue('whatsapp');
    }

    public function backoff(): array
    {
        return [60, 180];
    }

    public function handle(WhatsAppService $whatsApp): void
    {
        $pesquisa = PosVenda::with(['pedido.empresa', 'comanda.pedidos.empresa'])
            ->find($this->idPosVenda);

        if (!$pesquisa || !in_array($pesquisa->status, ['AGENDADA', 'ENVIANDO'], true)) {
            return;
        }

        if (($pesquisa->pedido && $pesquisa->pedido->status !== 'FINALIZADO')
            || ($pesquisa->comanda && $pesquisa->comanda->status !== 'PAGA')) {
            $pesquisa->update(['status' => 'CANCELADA']);

            return;
        }

        if (!$pesquisa->telefone) {
            $pesquisa->update(['status' => 'SEM_TELEFONE']);

            return;
        }

        $empresa = $pesquisa->pedido?->empresa
            ?? $pesquisa->comanda?->pedidos->first()?->empresa;
        if (!$empresa) {
            throw new RuntimeException('Nao foi possivel identificar a empresa da pesquisa de pos-venda.');
        }

        $pesquisa->update(['status' => 'ENVIANDO', 'dt_enviado' => now()]);

        $mensagem = $whatsApp->mensagemPosVenda($empresa);

        if (!$whatsApp->sendMessage($empresa, $pesquisa->telefone, $mensagem, $pesquisa->id_pos_venda)) {
            throw new RuntimeException('Nao foi possivel enviar a pesquisa de pos-venda pelo WhatsApp.');
        }

        $pesquisa->update(['status' => 'ENVIADA']);
    }

    public function failed(?Throwable $exception): void
    {
        PosVenda::whereKey($this->idPosVenda)
            ->whereIn('status', ['AGENDADA', 'ENVIANDO'])
            ->update(['status' => 'FALHA']);

        Log::error('Falha definitiva ao enviar pesquisa de pos-venda.', [
            'id_pos_venda' => $this->idPosVenda,
            'erro' => $exception?->getMessage(),
        ]);
    }
}
