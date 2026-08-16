<?php

namespace App\Http\Controllers\Api\Delivery;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Entrega;
use App\Models\ItemPedido;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\User;
use App\Http\Controllers\Api\Mesa\MesaSessionController;
use App\Services\GeocodingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Link publico de pedido delivery (cardapio online de verdade, substitui o protótipo em
 * localStorage). Sem sessao/token de mesa: o cliente se identifica (nome, telefone, endereco)
 * e fecha o pedido inteiro numa unica chamada - nao existe "comanda" pra delivery.
 */
class PedidoOnlineController extends Controller
{
    private const FRONT_TO_DB_PAYMENT = [
        'pix' => 'PIX',
        'cartao' => 'CARTAO',
        'dinheiro' => 'DINHEIRO',
    ];

    private const DB_TO_FRONT_STATUS = [
        'PENDENTE' => 'aguardando_confirmacao',
        'CONFIRMADO' => 'em_preparo',
        'PREPARANDO' => 'em_preparo',
        'PRONTO' => 'pronto',
        'ENTREGANDO' => 'saiu_entrega',
        'FINALIZADO' => 'entregue',
        'CANCELADO' => 'recusado',
    ];

    /**
     * GET /pedir
     * Dados do restaurante (unico, por enquanto) + cardapio real.
     */
    public function cardapio(Request $request): JsonResponse
    {
        $empresa = Empresa::orderBy('id_empresa')->first();

        if (!$empresa) {
            return response()->json(['message' => 'Nenhum restaurante configurado.'], 404);
        }

        $produtos = Produto::where('id_empresa', $empresa->id_empresa)
            ->where('fl_ativo', true)
            ->with('categoria')
            ->orderBy('nm_produto')
            ->get();

        return response()->json([
            'empresa' => [
                'nome' => $empresa->nm_empresa,
            ],
            'produtos' => $produtos->map(fn (Produto $produto) => [
                'id' => $produto->id_produto,
                'nome' => $produto->nm_produto,
                'descricao' => $produto->ds_produto,
                'preco' => (float) $produto->vl_preco_base,
                'categoria' => $produto->categoria?->nm_categoria,
                'imagem' => MesaSessionController::resolveImagemUrl($request, $produto->url_imagem),
            ])->values(),
        ]);
    }

    /**
     * POST /pedir
     * Body: { nome, telefone, endereco, payment_method, change_for?, items: [{id_produto, qty}] }
     * Preco sempre vem do catalogo (nunca do cliente), igual ao autoatendimento da mesa.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:150'],
            'telefone' => ['required', 'string', 'max:20'],
            'cep' => ['required', 'string', 'max:9'],
            'rua' => ['nullable', 'string', 'max:150'],
            'cidade' => ['nullable', 'string', 'max:100'],
            'uf' => ['nullable', 'string', 'max:2'],
            'endereco' => ['required', 'string', 'max:255'],
            'payment_method' => ['required', 'string', 'in:pix,cartao,dinheiro'],
            'change_for' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id_produto' => ['required', 'integer', 'exists:produto,id_produto'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $empresa = Empresa::orderBy('id_empresa')->first();
        if (!$empresa) {
            return response()->json(['message' => 'Nenhum restaurante configurado.'], 422);
        }

        $produtos = Produto::whereIn('id_produto', collect($data['items'])->pluck('id_produto'))
            ->where('id_empresa', $empresa->id_empresa)
            ->where('fl_ativo', true)
            ->get()
            ->keyBy('id_produto');

        // Geocodifica fora da transacao - e uma chamada de rede, nao deve segurar lock no banco.
        $coordenadas = app(GeocodingService::class)->coordenadasPorEndereco(
            $data['rua'] ?? null,
            $data['cidade'] ?? null,
            $data['uf'] ?? null,
            $data['cep'],
        );

        $pedido = DB::transaction(function () use ($data, $empresa, $produtos, $coordenadas) {
            $cliente = Cliente::with('usuario')->where('telefone', $data['telefone'])->first();

            if (!$cliente) {
                $emailSintetico = strtolower(preg_replace('/\s+/', '.', trim($data['nome'])))
                    . '+' . now()->timestamp . '@cliente.local';

                $usuario = User::create([
                    'nm_usuario' => $data['nome'],
                    'email' => $emailSintetico,
                    'senha_hash' => bcrypt(Str::random(40)),
                    'perfil' => 'CLIENTE',
                    'fl_ativo' => true,
                ]);

                $cliente = Cliente::create([
                    'id_usuario' => $usuario->id_usuario,
                    'telefone' => $data['telefone'],
                ])->load('usuario');
            }

            $total = 0;
            foreach ($data['items'] as $item) {
                $produto = $produtos->get($item['id_produto']);
                if ($produto) {
                    $total += (float) $produto->vl_preco_base * $item['qty'];
                }
            }

            // Numeracao propria do delivery, comecando do 1 - mesma regra do pedido criado
            // pelo admin (AdminOrderController::store), pra nao duplicar numero entre os dois canais.
            $nrPedidoDelivery = 1 + (int) DB::table('pedido')
                ->where('tipo_pedido', 'DELIVERY')
                ->lockForUpdate()
                ->max('nr_pedido_delivery');

            $pedido = Pedido::create([
                'id_empresa' => $empresa->id_empresa,
                'id_cliente' => $cliente->id_cliente,
                'codigo_qr' => (string) Str::uuid(),
                'tipo_pedido' => 'DELIVERY',
                'nr_pedido_delivery' => $nrPedidoDelivery,
                'canal_origem' => 'ONLINE',
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_taxa_entrega' => 8,
                'ds_observacao' => $data['endereco'],
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

            $formaPagamento = self::FRONT_TO_DB_PAYMENT[$data['payment_method']];

            Pagamento::create([
                'id_pedido' => $pedido->id_pedido,
                'forma' => $formaPagamento,
                'troco_para' => $formaPagamento === 'DINHEIRO' ? ($data['change_for'] ?? null) : null,
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_desconto' => 0,
                'vl_final' => round($total, 2),
            ]);

            Entrega::create([
                'id_pedido' => $pedido->id_pedido,
                'status_entrega' => 'AGUARDANDO',
                'latitude_destino' => $coordenadas['lat'] ?? null,
                'longitude_destino' => $coordenadas['lng'] ?? null,
            ]);

            return $pedido;
        });

        return response()->json([
            'codigo_qr' => $pedido->codigo_qr,
            'delivery_number' => $pedido->nr_pedido_delivery,
            'total' => (float) $pedido->vl_total,
            'status' => self::DB_TO_FRONT_STATUS[$pedido->status] ?? 'aguardando_confirmacao',
        ], 201);
    }

    /**
     * GET /pedir/cliente/{telefone}
     * Se esse telefone ja pediu antes, devolve o nome - autocompleta o cadastro pra quem
     * ja e cliente, sem precisar redigitar o nome toda vez (mesma logica do autoatendimento
     * da mesa).
     */
    public function clientePorTelefone(string $telefone): JsonResponse
    {
        $cliente = Cliente::with('usuario')->where('telefone', $telefone)->first();

        if (!$cliente || !$cliente->usuario) {
            return response()->json(['message' => 'Cliente nao encontrado.'], 404);
        }

        return response()->json(['nome' => $cliente->usuario->nm_usuario]);
    }

    /**
     * GET /pedir/status/{codigoQr}
     * O cliente acompanha o pedido por aqui (poll), sem precisar de login.
     */
    public function status(string $codigoQr): JsonResponse
    {
        $pedido = Pedido::with(['entrega.entregador.usuario'])
            ->where('codigo_qr', $codigoQr)
            ->where('canal_origem', 'ONLINE')
            ->first();

        if (!$pedido) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        return response()->json([
            'delivery_number' => $pedido->nr_pedido_delivery,
            'status' => self::DB_TO_FRONT_STATUS[$pedido->status] ?? 'aguardando_confirmacao',
            'motivo_cancelamento' => $pedido->motivo_cancelamento,
            'total' => (float) $pedido->vl_total,
            'entregador_nome' => $pedido->entrega?->entregador?->usuario?->nm_usuario,
        ]);
    }
}
