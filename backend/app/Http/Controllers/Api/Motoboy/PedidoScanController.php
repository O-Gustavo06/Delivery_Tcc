<?php

namespace App\Http\Controllers\Api\Motoboy;

use App\Http\Controllers\Controller;
use App\Models\Entrega;
use App\Models\Pedido;
use App\Services\RotaInteligenteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PedidoScanController extends Controller
{
    public function __construct(private RotaInteligenteService $rotaService)
    {
    }

    /**
     * GET /motoboy/pedidos/scan/{codigoQr}
     * Bipa o QR Code/código de barras da comanda. Retorna o pedido isolado
     * ou a rota inteira, caso ele já pertença/seja agrupado a outros pedidos próximos.
     */
    public function scan(Request $request, string $codigoQr): JsonResponse
    {
        $pedido = Pedido::with(['cliente.usuario', 'itens.produto', 'pagamento', 'entrega'])
            ->where('codigo_qr', $codigoQr)
            ->first();

        if (!$pedido) {
            return response()->json(['message' => 'Pedido não encontrado para este código.'], 404);
        }

        if ($pedido->tipo_pedido !== 'DELIVERY') {
            return response()->json(['message' => 'Este pedido não é de delivery.'], 422);
        }

        $entrega = $pedido->entrega;
        if (!$entrega) {
            return response()->json(['message' => 'Pedido ainda não possui registro de entrega/coordenadas.'], 422);
        }

        $entregador = $request->user()->entregador;
        if (!$entregador) {
            return response()->json(['message' => 'Usuário autenticado não é um entregador.'], 403);
        }

        $rota = $this->rotaService->atribuirOuAgrupar($entrega, $entregador);

        return response()->json($this->formatarRota($rota));
    }

    private function formatarRota($rota): array
    {
        return [
            'id_rota_entrega' => $rota->id_rota_entrega,
            'status' => $rota->status,
            'paradas' => $rota->itens->map(function ($item) {
                $entrega = $item->entrega;
                $pedido = $entrega->pedido;
                $pagamento = $pedido->pagamento;

                return [
                    'id_entrega' => $entrega->id_entrega,
                    'ordem' => $item->ordem_sequencia,
                    'id_pedido' => $pedido->id_pedido,
                    'status_entrega' => $entrega->status_entrega,
                    'endereco' => [
                        'latitude' => $entrega->latitude_destino,
                        'longitude' => $entrega->longitude_destino,
                    ],
                    'itens_resumo' => $pedido->itens->map(fn ($i) => "{$i->nr_quantidade}x {$i->produto->nm_produto}"),
                    'pagamento' => [
                        'forma' => $pagamento?->forma,
                        'valor_final' => $pagamento?->vl_final,
                        'troco_calculado' => $pagamento?->troco_calculado,
                    ],
                ];
            })->values(),
        ];
    }
}
