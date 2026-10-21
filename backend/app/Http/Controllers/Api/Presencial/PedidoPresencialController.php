<?php

namespace App\Http\Controllers\Api\Presencial;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\ItemPedido;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use App\Services\ClienteIdentityService;
use App\Services\PromocaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Pedido feito pelo cliente no cardapio presencial (/presencial), dentro do restaurante.
 * Entra como BALCAO + canal PRESENCIAL e status PENDENTE: aparece em /pedidos pro atendente
 * aceitar ou recusar, igual ao pedido online. Pagamento e sempre no caixa (sem gateway).
 */
class PedidoPresencialController extends Controller
{
    private const FRONT_TO_DB_PAYMENT = [
        'pix' => 'PIX',
        'cartao' => 'CARTAO',
        'dinheiro' => 'DINHEIRO',
    ];

    /**
     * POST /presencial/pedidos
     * Body: { nome, payment_method, note?, items: [{id_produto, qty}] }
     * Preco sempre vem do catalogo (nunca do cliente).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:150'],
            'telefone' => ['required', 'string', 'max:20'],
            'payment_method' => ['required', 'string', 'in:pix,cartao,dinheiro'],
            'note' => ['nullable', 'string', 'max:500'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id_produto' => ['required', 'integer', 'exists:produto,id_produto'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:50'],
        ]);

        $empresa = Empresa::orderBy('id_empresa')->first();
        if (!$empresa) {
            return response()->json(['message' => 'Nenhum restaurante configurado.'], 422);
        }

        if (!$empresa->fl_aberto) {
            return response()->json(['message' => 'O restaurante esta fechado no momento.'], 422);
        }

        $produtos = Produto::whereIn('id_produto', collect($data['items'])->pluck('id_produto'))
            ->where('id_empresa', $empresa->id_empresa)
            ->where('fl_ativo', true)
            ->get()
            ->keyBy('id_produto');

        if ($produtos->count() !== collect($data['items'])->pluck('id_produto')->unique()->count()) {
            return response()->json(['message' => 'Um ou mais produtos não estão disponíveis para pedido.'], 422);
        }

        $pedido = DB::transaction(function () use ($data, $empresa, $produtos) {
            $cliente = app(ClienteIdentityService::class)->buscarOuCriar($data['nome'], $data['telefone']);

            return $this->createOrderForExistingCustomer($data, $empresa, $produtos, $cliente);
        });

        return response()->json([
            'number' => $pedido->id_pedido,
            'codigo_qr' => $pedido->codigo_qr,
            'total' => (float) $pedido->vl_total,
            'discount' => (float) ($pedido->pagamento?->vl_desconto ?? 0),
        ], 201);
    }

    private function createOrderForExistingCustomer(array $data, Empresa $empresa, $produtos, Cliente $cliente): Pedido
    {
        $calculation = app(PromocaoService::class)->calcular(
            (int) $empresa->id_empresa,
            $data['items'],
            $produtos,
            $data['coupon_code'] ?? null,
            (int) $cliente->id_cliente,
            true,
        );

        $pedido = Pedido::create([
            'id_empresa' => $empresa->id_empresa,
            'id_cliente' => $cliente->id_cliente,
            'codigo_qr' => (string) Str::uuid(),
            'tipo_pedido' => 'BALCAO',
            'canal_origem' => 'PRESENCIAL',
            'status' => 'PENDENTE',
            'vl_total' => $calculation['subtotal'],
            'vl_taxa_entrega' => 0,
            'ds_nota_pedido' => !empty($data['note']) ? mb_strtoupper(trim($data['note'])) : null,
        ]);

        foreach ($calculation['order_items'] as $item) {
            ItemPedido::create([
                'id_pedido' => $pedido->id_pedido,
                'id_produto' => $item['id_produto'],
                'nr_quantidade' => $item['qty'],
                'vl_preco_unitario' => $item['unit_price'],
                'vl_subtotal' => $item['subtotal'],
            ]);
        }

        Pagamento::create([
            'id_pedido' => $pedido->id_pedido,
            'forma' => self::FRONT_TO_DB_PAYMENT[$data['payment_method']],
            'status' => 'PENDENTE',
            'vl_total' => $calculation['original_subtotal'],
            'vl_desconto' => $calculation['discount'],
            'vl_final' => $calculation['subtotal'],
        ]);
        app(PromocaoService::class)->registrarUtilizacoes($calculation, $pedido, (int) $cliente->id_cliente);

        return $pedido->load('pagamento');
    }
}
