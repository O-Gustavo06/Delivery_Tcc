<?php

namespace App\Http\Controllers\Api\Presencial;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\ItemPedido;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
            'payment_method' => ['required', 'string', 'in:pix,cartao,dinheiro'],
            'note' => ['nullable', 'string', 'max:500'],
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

        if ($produtos->isEmpty()) {
            return response()->json(['message' => 'Esse prato nao esta disponivel no momento.'], 422);
        }

        $pedido = DB::transaction(function () use ($data, $empresa, $produtos) {
            // Sem telefone no balcao: cada pedido gera um cliente so com o nome (o atendente chama por ele).
            $emailSintetico = strtolower(preg_replace('/\s+/', '.', trim($data['nome'])))
                . '+' . now()->timestamp . Str::lower(Str::random(4)) . '@cliente.local';

            $usuario = User::create([
                'nm_usuario' => $data['nome'],
                'email' => $emailSintetico,
                'senha_hash' => bcrypt(Str::random(40)),
                'perfil' => 'CLIENTE',
                'fl_ativo' => true,
            ]);

            $cliente = Cliente::create([
                'id_usuario' => $usuario->id_usuario,
            ]);

            $total = 0;
            foreach ($data['items'] as $item) {
                $produto = $produtos->get($item['id_produto']);
                if ($produto) {
                    $total += (float) $produto->vl_preco_base * $item['qty'];
                }
            }

            $pedido = Pedido::create([
                'id_empresa' => $empresa->id_empresa,
                'id_cliente' => $cliente->id_cliente,
                'codigo_qr' => (string) Str::uuid(),
                'tipo_pedido' => 'BALCAO',
                'canal_origem' => 'PRESENCIAL',
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_taxa_entrega' => 0,
                'ds_nota_pedido' => !empty($data['note']) ? mb_strtoupper(trim($data['note'])) : null,
            ]);

            foreach ($data['items'] as $item) {
                $produto = $produtos->get($item['id_produto']);
                if (!$produto) {
                    continue;
                }

                ItemPedido::create([
                    'id_pedido' => $pedido->id_pedido,
                    'id_produto' => $produto->id_produto,
                    'nr_quantidade' => $item['qty'],
                    'vl_preco_unitario' => $produto->vl_preco_base,
                    'vl_subtotal' => round((float) $produto->vl_preco_base * $item['qty'], 2),
                ]);
            }

            Pagamento::create([
                'id_pedido' => $pedido->id_pedido,
                'forma' => self::FRONT_TO_DB_PAYMENT[$data['payment_method']],
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_desconto' => 0,
                'vl_final' => round($total, 2),
            ]);

            return $pedido;
        });

        return response()->json([
            'number' => $pedido->id_pedido,
            'codigo_qr' => $pedido->codigo_qr,
            'total' => (float) $pedido->vl_total,
        ], 201);
    }
}
