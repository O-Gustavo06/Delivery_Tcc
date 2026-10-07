<?php

namespace App\Http\Controllers\Api\Motoboy;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistoricoController extends Controller
{
    /**
     * GET /motoboy/entregas/historico?periodo=dia|geral
     */
    public function index(Request $request): JsonResponse
    {
        $periodo = $request->query('periodo', 'dia');

        $entregador = $request->user()->entregador;
        if (!$entregador) {
            return response()->json(['message' => 'Usuário autenticado não é um entregador.'], 403);
        }

        $query = $entregador->entregas()
            ->where('status_entrega', 'ENTREGUE')
            ->with('pedido.pagamento')
            ->orderByDesc('horario_chegada');

        if ($periodo === 'dia') {
            $query->whereDate('horario_chegada', now()->toDateString());
        }

        $entregas = $query->get();

        return response()->json([
            'periodo' => $periodo,
            'total_entregas' => $entregas->count(),
            'total_taxas' => $entregas->sum(fn ($e) => $e->pedido->vl_taxa_entrega),
            'entregas' => $entregas->map(fn ($e) => [
                'id_entrega' => $e->id_entrega,
                'id_pedido' => $e->id_pedido,
                'nr_pedido_delivery' => $e->pedido->nr_pedido_delivery,
                'concluida_em' => $e->horario_chegada,
                'taxa' => $e->pedido->vl_taxa_entrega,
                'forma_pagamento' => $e->pedido->pagamento?->forma,
            ]),
        ]);
    }
}
