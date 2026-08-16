<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comanda;
use App\Models\Pagamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ComandaController extends Controller
{
    /**
     * GET /admin/comandas/pendentes
     * Fila de quem pediu pra fechar (Pix "ja paguei" ou cartao/dinheiro conferido na mesa)
     * e ta esperando o caixa confirmar e liberar a mesa.
     */
    public function pendentes(): JsonResponse
    {
        $comandas = Comanda::with(['mesa', 'pedidos.itens.produto', 'pedidos.cliente.usuario'])
            ->where('status', 'AGUARDANDO_PAGAMENTO')
            ->orderBy('dt_atualizacao')
            ->get();

        return response()->json($comandas->map(fn (Comanda $comanda) => $this->toPayload($comanda))->values());
    }

    /**
     * POST /admin/comandas/{id}/confirmar-pagamento
     * Um toque: marca todos os pedidos da comanda como pagos e libera a mesa pro proximo cliente.
     */
    public function confirmarPagamento(Request $request, string $id): JsonResponse
    {
        $comanda = Comanda::with('mesa', 'pedidos')->find((int) $id);

        if (!$comanda) {
            return response()->json(['message' => 'Comanda nao encontrada.'], 404);
        }

        if ($comanda->status !== 'AGUARDANDO_PAGAMENTO') {
            return response()->json(['message' => 'Essa comanda nao esta aguardando confirmacao.'], 422);
        }

        DB::transaction(function () use ($comanda, $request) {
            Pagamento::whereIn('id_pedido', $comanda->pedidos->pluck('id_pedido'))
                ->update(['status' => 'APROVADO']);

            $comanda->update([
                'status' => 'PAGA',
                'dt_fechamento' => now(),
                'id_usuario_confirmou' => $request->user()->id_usuario,
            ]);

            // So libera a mesa se nao tiver outra comanda aberta nela (nao deveria acontecer,
            // mas evita liberar uma mesa que outro cliente ja reabriu).
            if (!$comanda->mesa->comandaAberta()->exists()) {
                $comanda->mesa->update(['status_ocupacao' => 'LIVRE']);
            }
        });

        return response()->json($this->toPayload($comanda->fresh(['mesa', 'pedidos.itens.produto', 'pedidos.cliente.usuario'])));
    }

    /**
     * POST /admin/comandas/{id}/cancelar
     * Escape hatch: abriu por engano, mesa ficou vazia sem pedido, etc.
     */
    public function cancelar(string $id): JsonResponse
    {
        $comanda = Comanda::with('mesa')->find((int) $id);

        if (!$comanda) {
            return response()->json(['message' => 'Comanda nao encontrada.'], 404);
        }

        $comanda->update(['status' => 'CANCELADA', 'dt_fechamento' => now()]);

        if (!$comanda->mesa->comandaAberta()->exists()) {
            $comanda->mesa->update(['status_ocupacao' => 'LIVRE']);
        }

        return response()->json(['message' => 'Comanda cancelada.']);
    }

    private function toPayload(Comanda $comanda): array
    {
        return [
            'id_comanda' => $comanda->id_comanda,
            'mesa' => $comanda->mesa->nr_mesa,
            'status' => $comanda->status,
            'forma_pagamento' => $comanda->forma_pagamento,
            'total' => (float) $comanda->pedidos->sum('vl_total'),
            'aberta_desde' => optional($comanda->dt_cadastro)->toIso8601String(),
            'pedidos' => $comanda->pedidos->map(fn ($pedido) => [
                'id_pedido' => $pedido->id_pedido,
                'cliente_nome' => $pedido->cliente?->usuario?->nm_usuario,
                'total' => (float) $pedido->vl_total,
                'itens' => $pedido->itens->map(fn ($item) => "{$item->nr_quantidade}x {$item->produto?->nm_produto}"),
            ]),
        ];
    }
}
