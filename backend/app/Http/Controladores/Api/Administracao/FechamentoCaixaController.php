<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Entrega;
use App\Models\Entregador;
use App\Models\FechamentoCaixaEntregador;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FechamentoCaixaController extends Controller
{
    /**
     * GET /admin/motoboys/fechamento?data=YYYY-MM-DD
     * Calcula (ou recupera, se já fechado) o resumo de cada entregador no dia.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->query('data', now()->toDateString());

        $entregadores = Entregador::with('usuario')->get();

        $resumo = $entregadores->map(function (Entregador $entregador) use ($data) {
            $fechamento = FechamentoCaixaEntregador::where('id_entregador', $entregador->id_entregador)
                ->where('dt_referencia', $data)
                ->first();

            if ($fechamento) {
                return $this->formatar($entregador, $fechamento);
            }

            // Ainda não fechado: calcula em tempo real a partir das entregas concluídas no dia.
            $entregas = Entrega::where('id_entregador', $entregador->id_entregador)
                ->where('status_entrega', 'ENTREGUE')
                ->whereDate('horario_chegada', $data)
                ->with('pedido.pagamento')
                ->get();

            $qtdEntregas = $entregas->count();
            $totalTaxas = $entregas->sum(fn ($e) => $e->pedido->vl_taxa_entrega);
            $totalDinheiro = $entregas
                ->filter(fn ($e) => $e->pedido->pagamento?->forma === 'DINHEIRO')
                ->sum(fn ($e) => $e->pedido->pagamento->vl_final);

            return [
                'id_entregador' => $entregador->id_entregador,
                'nome' => $entregador->usuario->nm_usuario,
                'dt_referencia' => $data,
                'qtd_entregas' => $qtdEntregas,
                'vl_total_taxas' => round($totalTaxas, 2),
                'vl_dinheiro_recebido' => round($totalDinheiro, 2),
                'status_pagamento' => 'PENDENTE',
                'fechado' => false,
            ];
        })->filter(fn ($r) => $r['qtd_entregas'] > 0)->values();

        return response()->json($resumo);
    }

    /**
     * POST /admin/motoboys/{entregador}/fechamento/pagar
     * Body: { "data": "YYYY-MM-DD" }
     * Congela o resumo do dia e marca como pago.
     */
    public function pagar(Request $request, int $entregadorId): JsonResponse
    {
        $data = $request->validate(['data' => ['required', 'date']]);

        $entregador = Entregador::findOrFail($entregadorId);

        $entregas = Entrega::where('id_entregador', $entregador->id_entregador)
            ->where('status_entrega', 'ENTREGUE')
            ->whereDate('horario_chegada', $data['data'])
            ->with('pedido.pagamento')
            ->get();

        $fechamento = FechamentoCaixaEntregador::updateOrCreate(
            ['id_entregador' => $entregador->id_entregador, 'dt_referencia' => $data['data']],
            [
                'qtd_entregas' => $entregas->count(),
                'vl_total_taxas' => round($entregas->sum(fn ($e) => $e->pedido->vl_taxa_entrega), 2),
                'vl_dinheiro_recebido' => round(
                    $entregas->filter(fn ($e) => $e->pedido->pagamento?->forma === 'DINHEIRO')
                        ->sum(fn ($e) => $e->pedido->pagamento->vl_final),
                    2
                ),
                'status_pagamento' => 'PAGO',
                'dt_fechamento' => now(),
            ]
        );

        return response()->json($this->formatar($entregador, $fechamento));
    }

    /**
     * GET /admin/motoboys/{entregador}/entregas
     * Historico de rotas/entregas desse entregador - rua, valor, forma de pagamento etc.
     */
    public function entregas(int $entregadorId): JsonResponse
    {
        $entregador = Entregador::with('usuario')->find($entregadorId);

        if (!$entregador) {
            return response()->json(['message' => 'Entregador nao encontrado.'], 404);
        }

        $entregas = Entrega::where('id_entregador', $entregadorId)
            ->with(['pedido.pagamento', 'pedido.cliente.usuario'])
            ->orderByDesc('dt_atualizacao')
            ->limit(50)
            ->get();

        return response()->json([
            'entregador' => [
                'id' => $entregador->id_entregador,
                'nome' => $entregador->usuario?->nm_usuario,
                'online' => (bool) $entregador->fl_online,
            ],
            'entregas' => $entregas->map(fn (Entrega $entrega) => [
                'id_entrega' => $entrega->id_entrega,
                'id_pedido' => $entrega->id_pedido,
                'status_entrega' => $entrega->status_entrega,
                'endereco' => $entrega->pedido?->ds_observacao,
                'cliente_nome' => $entrega->pedido?->cliente?->usuario?->nm_usuario ?? 'Cliente',
                'valor' => (float) ($entrega->pedido?->vl_total ?? 0),
                'forma_pagamento' => $entrega->pedido?->pagamento?->forma,
                'saiu_em' => optional($entrega->horario_saida)->format('Y-m-d H:i:s'),
                'chegou_em' => optional($entrega->horario_chegada)->format('Y-m-d H:i:s'),
            ])->values(),
        ]);
    }

    private function formatar(Entregador $entregador, FechamentoCaixaEntregador $fechamento): array
    {
        return [
            'id_entregador' => $entregador->id_entregador,
            'nome' => $entregador->usuario->nm_usuario,
            'dt_referencia' => $fechamento->dt_referencia->toDateString(),
            'qtd_entregas' => $fechamento->qtd_entregas,
            'vl_total_taxas' => $fechamento->vl_total_taxas,
            'vl_dinheiro_recebido' => $fechamento->vl_dinheiro_recebido,
            'status_pagamento' => $fechamento->status_pagamento,
            'fechado' => true,
        ];
    }
}
