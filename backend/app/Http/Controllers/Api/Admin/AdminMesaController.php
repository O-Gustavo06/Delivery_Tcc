<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comanda;
use App\Models\Mesa;
use App\Models\MesaFilaEspera;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminMesaController extends Controller
{
    private function empresaId(): int
    {
        return (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');
    }

    /**
     * GET /admin/mesas/fila-espera
     */
    public function listarFilaEspera(): JsonResponse
    {
        $fila = MesaFilaEspera::where('id_empresa', $this->empresaId())
            ->orderBy('dt_cadastro')
            ->get();

        return response()->json([
            'data' => $fila->map(fn (MesaFilaEspera $entrada) => $this->filaEsperaPayload($entrada))->values(),
        ]);
    }

    /**
     * POST /admin/mesas/fila-espera
     */
    public function adicionarNaFilaEspera(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nm_cliente' => ['required', 'string', 'max:150'],
            'nr_pessoas' => ['required', 'integer', 'min:1', 'max:50'],
        ]);

        $entrada = MesaFilaEspera::create([
            'id_empresa' => $this->empresaId(),
            'nm_cliente' => $data['nm_cliente'],
            'nr_pessoas' => $data['nr_pessoas'],
        ]);

        return response()->json($this->filaEsperaPayload($entrada), 201);
    }

    /**
     * DELETE /admin/mesas/fila-espera/{id}
     * Cliente foi chamado pra mesa ou desistiu de esperar - de qualquer forma, sai da fila.
     */
    public function removerDaFilaEspera(int $id): JsonResponse
    {
        $entrada = MesaFilaEspera::where('id_empresa', $this->empresaId())->find($id);

        if (!$entrada) {
            return response()->json(['message' => 'Nao encontrado na fila de espera.'], 404);
        }

        $entrada->delete();

        return response()->json(['message' => 'Removido da fila de espera.']);
    }

    private function filaEsperaPayload(MesaFilaEspera $entrada): array
    {
        return [
            'id' => $entrada->id_fila_espera,
            'name' => $entrada->nm_cliente,
            'size' => $entrada->nr_pessoas,
            'esperandoDesde' => $entrada->dt_cadastro->format('Y-m-d H:i:s'),
        ];
    }

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

    /**
     * POST /admin/mesas/{id}/liberar
     * Escape hatch manual: cliente foi embora sem fechar a comanda direito, mesa travou
     * ocupada por engano, etc. Cancela a comanda aberta (se houver) e marca a mesa como livre.
     */
    public function liberar(int $id): JsonResponse
    {
        $mesa = Mesa::with('comandaAberta')->find($id);

        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        if ($mesa->comandaAberta) {
            $mesa->comandaAberta->update(['status' => 'CANCELADA', 'dt_fechamento' => now()]);
        }

        $mesa->update(['status_ocupacao' => 'LIVRE']);

        return response()->json(['message' => 'Mesa liberada.', 'status' => 'LIVRE']);
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
