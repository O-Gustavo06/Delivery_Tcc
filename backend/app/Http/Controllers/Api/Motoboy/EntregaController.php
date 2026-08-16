<?php

namespace App\Http\Controllers\Api\Motoboy;

use App\Http\Controllers\Controller;
use App\Models\Entrega;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EntregaController extends Controller
{
    /**
     * PATCH /motoboy/entregas/{entrega}/iniciar
     */
    public function iniciar(Request $request, Entrega $entrega): JsonResponse
    {
        $this->autorizarEntregador($request, $entrega);

        DB::transaction(function () use ($entrega) {
            $entrega->update([
                'status_entrega' => 'EM_ROTA',
                'horario_saida' => now(),
            ]);

            // O motoboy iniciar a entrega É o pedido saindo pra entrega - o admin/cozinha
            // nao deveria precisar clicar em nada pra essa mudanca aparecer la tambem.
            $entrega->pedido?->update(['status' => 'ENTREGANDO']);
        });

        return response()->json(['message' => 'Entrega iniciada.', 'status_entrega' => $entrega->status_entrega]);
    }

    /**
     * PATCH /motoboy/entregas/{entrega}/concluir
     * Body: { "codigo_confirmacao": "1234" } (quando aplicável a plataformas externas)
     */
    public function concluir(Request $request, Entrega $entrega): JsonResponse
    {
        $this->autorizarEntregador($request, $entrega);

        $data = $request->validate([
            'codigo_confirmacao' => ['nullable', 'string', 'max:20'],
        ]);

        // Se o pedido veio de plataforma externa e exige código, valida antes de concluir.
        if ($entrega->codigo_confirmacao_entrega && $data['codigo_confirmacao'] !== $entrega->codigo_confirmacao_entrega) {
            return response()->json(['message' => 'Código de confirmação inválido.'], 422);
        }

        DB::transaction(function () use ($entrega) {
            $entrega->update([
                'status_entrega' => 'ENTREGUE',
                'horario_chegada' => now(),
            ]);

            $entrega->pedido?->update(['status' => 'FINALIZADO', 'dt_conclusao' => now()]);

            $item = $entrega->rotaEntregaItem;
            if ($item) {
                $item->update(['dt_entregue' => now()]);

                $rota = $item->rota;
                $todasEntregues = $rota->itens()->whereNull('dt_entregue')->doesntExist();
                if ($todasEntregues) {
                    $rota->update(['status' => 'CONCLUIDA']);
                }
            }
        });

        return response()->json(['message' => 'Entrega concluída.', 'status_entrega' => $entrega->fresh()->status_entrega]);
    }

    private function autorizarEntregador(Request $request, Entrega $entrega): void
    {
        $entregador = $request->user()->entregador;

        abort_if(!$entregador || $entrega->id_entregador !== $entregador->id_entregador, 403, 'Esta entrega não pertence a você.');
    }
}
