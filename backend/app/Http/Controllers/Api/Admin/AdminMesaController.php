<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comanda;
use App\Models\Mesa;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;

class AdminMesaController extends Controller
{
    /**
     * GET /admin/mesas/{id}
     * Detalhe de uma mesa do salao: comanda aberta agora (quem pediu, o que, quanto) e um
     * historico das ultimas comandas fechadas/canceladas dela.
     */
    public function show(int $id): JsonResponse
    {
        $mesa = Mesa::with([
            'comandaAberta.pedidos.itens.produto',
            'comandaAberta.pedidos.cliente.usuario',
        ])->find($id);

        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        $historico = Comanda::where('id_mesa', $id)
            ->whereIn('status', ['PAGA', 'CANCELADA'])
            ->whereNotIn('id_comanda', $mesa->comandaAberta ? [$mesa->comandaAberta->id_comanda] : [])
            ->with(['pedidos.itens.produto', 'pedidos.cliente.usuario'])
            ->orderByDesc('dt_fechamento')
            ->limit(8)
            ->get();

        return response()->json([
            'mesa' => [
                'id' => $mesa->id_mesa,
                'numero' => $mesa->nr_mesa,
                'capacidade' => $mesa->capacidade,
                'status' => $mesa->status_ocupacao,
            ],
            'comanda_atual' => $mesa->comandaAberta ? $this->comandaPayload($mesa->comandaAberta) : null,
            'historico' => $historico->map(fn (Comanda $comanda) => $this->comandaPayload($comanda))->values(),
        ]);
    }

    private function comandaPayload(Comanda $comanda): array
    {
        return [
            'id_comanda' => $comanda->id_comanda,
            'status' => $comanda->status,
            'forma_pagamento' => $comanda->forma_pagamento,
            'total' => (float) $comanda->pedidos->sum('vl_total'),
            'dt_fechamento' => optional($comanda->dt_fechamento)->format('Y-m-d H:i:s'),
            'pedidos' => $comanda->pedidos->map(fn (Pedido $pedido) => [
                'id_pedido' => $pedido->id_pedido,
                'cliente_nome' => $pedido->cliente?->usuario?->nm_usuario ?? 'Cliente',
                'status' => $pedido->status,
                'total' => (float) $pedido->vl_total,
                'itens' => $pedido->itens->map(fn ($item) => [
                    'nome' => $item->produto?->nm_produto ?? 'Item',
                    'qty' => (int) $item->nr_quantidade,
                    'preco' => (float) $item->vl_preco_unitario,
                ]),
            ])->values(),
        ];
    }
}
