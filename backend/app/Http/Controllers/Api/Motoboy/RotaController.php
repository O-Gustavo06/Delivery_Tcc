<?php

namespace App\Http\Controllers\Api\Motoboy;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RotaController extends Controller
{
    /**
     * GET /motoboy/rotas/ativa
     */
    public function ativa(Request $request): JsonResponse
    {
        $entregador = $request->user()->entregador;

        if (!$entregador) {
            return response()->json(['message' => 'Usuário autenticado não é um entregador.'], 403);
        }

        $rota = $entregador->rotaAtiva()->with(
            'itens.entrega.pedido.pagamento',
            'itens.entrega.pedido.itens.produto',
            'itens.entrega.pedido.cliente.usuario',
        )->first();

        if (!$rota) {
            return response()->json(['message' => 'Nenhuma rota ativa no momento.'], 404);
        }

        return response()->json($rota);
    }

    /**
     * PATCH /motoboy/rotas/{rota}/reordenar
     * Body: { "ordem": [id_entrega, id_entrega, ...] }
     * Escape hatch manual, caso o motoboy precise pular uma parada.
     */
    public function reordenar(Request $request, int $rotaId): JsonResponse
    {
        $data = $request->validate([
            'ordem' => ['required', 'array', 'min:1'],
            'ordem.*' => ['integer'],
        ]);

        $entregador = $request->user()->entregador;
        $rota = $entregador->rotas()->findOrFail($rotaId);

        foreach ($data['ordem'] as $posicao => $idEntrega) {
            $rota->itens()->where('id_entrega', $idEntrega)->update(['ordem_sequencia' => $posicao + 1]);
        }

        return response()->json($rota->fresh('itens'));
    }
}
