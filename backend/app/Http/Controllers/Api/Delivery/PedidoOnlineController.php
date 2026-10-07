<?php

namespace App\Http\Controllers\Api\Delivery;

use App\Http\Controllers\Controller;
use App\Models\Avaliacao;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Entrega;
use App\Models\ItemPedido;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\PushSubscription;
use App\Models\TransacaoPagamento;
use App\Models\User;
use App\Http\Controllers\Api\Mesa\MesaSessionController;
use App\Services\GeocodingService;
use App\Services\TaxaEntregaService;
use App\Services\AsaasService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\RequestException;
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
        'cartao_online' => 'CARTAO',
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

        // Nota media real do restaurante, calculada a partir das avaliacoes de pedido de
        // verdade (mesma tabela usada pra nota do entregador em /entrega) - nao mostra nada
        // (sem "4,8" inventado) enquanto ninguem avaliou ainda.
        $avaliacoes = Avaliacao::query()
            ->join('pedido', 'pedido.id_pedido', '=', 'avaliacao.id_pedido')
            ->where('pedido.id_empresa', $empresa->id_empresa)
            ->selectRaw('AVG(avaliacao.nota) as media, COUNT(*) as total')
            ->first();

        return response()->json([
            'empresa' => [
                'nome' => $empresa->nm_empresa,
                'aberto' => (bool) $empresa->fl_aberto,
                'taxa_entrega_padrao' => (float) ($empresa->config_taxas_km['taxa_padrao'] ?? 8.0),
                'nota_media' => $avaliacoes->total > 0 ? round((float) $avaliacoes->media, 1) : null,
                'qtd_avaliacoes' => (int) $avaliacoes->total,
                'vapid_public_key' => config('services.vapid.public_key'),
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
            'tipo_entrega' => ['required', 'string', 'in:delivery,retirada'],
            'cep' => ['required_if:tipo_entrega,delivery', 'nullable', 'string', 'max:9'],
            'rua' => ['nullable', 'string', 'max:150'],
            'cidade' => ['nullable', 'string', 'max:100'],
            'uf' => ['nullable', 'string', 'max:2'],
            'endereco' => ['required_if:tipo_entrega,delivery', 'nullable', 'string', 'max:255'],
            'payment_method' => ['required', 'string', 'in:pix,cartao,cartao_online,dinheiro'],
            'cpf_cnpj' => ['required_if:payment_method,pix,cartao_online', 'nullable', 'string', 'max:18'],
            'email' => ['nullable', 'email', 'max:150'],
            'numero' => ['nullable', 'string', 'max:20'],
            'change_for' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id_produto' => ['required', 'integer', 'exists:produto,id_produto'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $isRetirada = $data['tipo_entrega'] === 'retirada';

        $empresa = Empresa::orderBy('id_empresa')->first();
        if (!$empresa) {
            return response()->json(['message' => 'Nenhum restaurante configurado.'], 422);
        }

        if (!$empresa->fl_aberto) {
            return response()->json(['message' => 'O restaurante esta fechado no momento. Tente novamente mais tarde.'], 422);
        }

        $produtos = Produto::whereIn('id_produto', collect($data['items'])->pluck('id_produto'))
            ->where('id_empresa', $empresa->id_empresa)
            ->where('fl_ativo', true)
            ->get()
            ->keyBy('id_produto');

        // Retirada no balcao nao tem endereco pra geocodificar - poupa a chamada de rede.
        $coordenadas = $isRetirada ? [] : app(GeocodingService::class)->coordenadasPorEndereco(
            $data['rua'] ?? null,
            $data['cidade'] ?? null,
            $data['uf'] ?? null,
            $data['cep'],
        );

        $taxaEntrega = $isRetirada ? 0 : app(TaxaEntregaService::class)->calcular($coordenadas['lat'] ?? null, $coordenadas['lng'] ?? null);

        $pedido = DB::transaction(function () use ($data, $empresa, $produtos, $coordenadas, $isRetirada, $taxaEntrega) {
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
            // pelo admin (AdminOrderController::store), pra nao duplicar numero entre os dois
            // canais. Retirada no balcao nao entra nessa numeracao (so existe pra motoboy).
            $nrPedidoDelivery = null;
            if (!$isRetirada) {
                $nrPedidoDelivery = 1 + (int) DB::table('pedido')
                    ->where('tipo_pedido', 'DELIVERY')
                    ->lockForUpdate()
                    ->max('nr_pedido_delivery');
            }

            $pedido = Pedido::create([
                'id_empresa' => $empresa->id_empresa,
                'id_cliente' => $cliente->id_cliente,
                'codigo_qr' => (string) Str::uuid(),
                'tipo_pedido' => $isRetirada ? 'BALCAO' : 'DELIVERY',
                'nr_pedido_delivery' => $nrPedidoDelivery,
                'canal_origem' => 'ONLINE',
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_taxa_entrega' => $taxaEntrega,
                'ds_observacao' => $isRetirada ? null : $data['endereco'],
                'ds_nota_pedido' => !empty($data['note']) ? mb_strtoupper($data['note']) : null,
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

            // Retirada no balcao nao tem entrega/motoboy - so pedido delivery precisa desse
            // registro (mesma regra do AdminOrderController::store pra pedido de balcao).
            if (!$isRetirada) {
                Entrega::create([
                    'id_pedido' => $pedido->id_pedido,
                    'status_entrega' => 'AGUARDANDO',
                    'latitude_destino' => $coordenadas['lat'] ?? null,
                    'longitude_destino' => $coordenadas['lng'] ?? null,
                ]);
            }

            return $pedido;
        });

        try {
            $paymentPayload = $this->createGatewayPayment($pedido, $data);
        } catch (RequestException $exception) {
            Pagamento::where('id_pedido', $pedido->id_pedido)->update(['status' => 'CANCELADO']);
            $description = data_get($exception->response?->json(), 'errors.0.description');

            return response()->json([
                'message' => $description ?: 'Nao foi possivel iniciar o pagamento online. Tente outra forma de pagamento.',
                'codigo_qr' => $pedido->codigo_qr,
                'number' => $pedido->id_pedido,
            ], 422);
        }

        return response()->json([
            'codigo_qr' => $pedido->codigo_qr,
            'number' => $pedido->id_pedido,
            'delivery_number' => $pedido->nr_pedido_delivery,
            'tipo_entrega' => $isRetirada ? 'retirada' : 'delivery',
            'total' => (float) $pedido->vl_total,
            'status' => self::DB_TO_FRONT_STATUS[$pedido->status] ?? 'aguardando_confirmacao',
            'payment' => $paymentPayload,
        ], 201);
    }

    private function createGatewayPayment(Pedido $pedido, array $data): ?array
    {
        $formaPagamento = self::FRONT_TO_DB_PAYMENT[$data['payment_method']];
        if (!in_array($data['payment_method'], ['pix', 'cartao_online'], true) || !app(AsaasService::class)->enabled()) {
            return null;
        }

        $pagamento = Pagamento::where('id_pedido', $pedido->id_pedido)->firstOrFail();
        $valor = round((float) $pedido->vl_total + (float) $pedido->vl_taxa_entrega, 2);
        $asaas = app(AsaasService::class);
        $customer = $asaas->createCustomer(
            $data['nome'],
            $data['telefone'],
            $data['cpf_cnpj'],
            $data['email'] ?? null,
            $data['rua'] ?? $data['endereco'] ?? null,
            $data['numero'] ?? null,
            $data['cep'] ?? null,
            $data['cidade'] ?? null,
            $data['uf'] ?? null,
            "cliente:{$pedido->id_cliente}",
        );
        $reference = "pedido:{$pedido->id_pedido}";
        $description = "Pedido #{$pedido->id_pedido} - Restaurante Modelo";
        $gatewayPayment = $data['payment_method'] === 'pix'
            ? $asaas->createPixPayment($customer['id'], $valor, $reference, $description)
            : $asaas->createCardCheckout($customer['id'], $valor, $reference, $description);
        $pix = $formaPagamento === 'PIX' ? $asaas->getPixQrCode($gatewayPayment['id']) : [];

        TransacaoPagamento::create([
            'id_pagamento' => $pagamento->id_pagamento,
            'provedor' => 'ASAAS',
            'nsu' => $gatewayPayment['id'],
            'status' => 'PENDENTE',
            'payload_json' => ['payment' => $gatewayPayment, 'pix' => $pix],
        ]);

        return [
            'method' => strtolower($formaPagamento),
            'status' => 'PENDENTE',
            'pix' => $formaPagamento === 'PIX' ? [
                'encoded_image' => $pix['encodedImage'] ?? null,
                'payload' => $pix['payload'] ?? null,
            ] : null,
            'checkout_url' => $formaPagamento === 'CARTAO' ? ($gatewayPayment['link'] ?? null) : null,
        ];
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
        $pedido = Pedido::with(['entrega.entregador.usuario', 'avaliacao'])
            ->where('codigo_qr', $codigoQr)
            ->where('canal_origem', 'ONLINE')
            ->first();

        if (!$pedido) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        return response()->json([
            'number' => $pedido->id_pedido,
            'delivery_number' => $pedido->nr_pedido_delivery,
            'tipo_entrega' => $pedido->tipo_pedido === 'BALCAO' ? 'retirada' : 'delivery',
            'status' => self::DB_TO_FRONT_STATUS[$pedido->status] ?? 'aguardando_confirmacao',
            'motivo_cancelamento' => $pedido->motivo_cancelamento,
            'total' => (float) $pedido->vl_total,
            'payment' => $this->paymentPayload($pedido),
            'entregador_nome' => $pedido->entrega?->entregador?->usuario?->nm_usuario,
            'avaliacao' => $pedido->avaliacao ? [
                'nota' => $pedido->avaliacao->nota,
                'comentario' => $pedido->avaliacao->ds_comentario,
            ] : null,
        ]);
    }

    private function paymentPayload(Pedido $pedido): ?array
    {
        $pagamento = $pedido->pagamento()->with('transacoes')->first();
        $transacao = $pagamento?->transacoes->where('provedor', 'ASAAS')->sortByDesc('id_transacao')->first();
        $gateway = $transacao?->payload_json ?? [];
        $pix = $gateway['pix'] ?? [];
        $payment = $gateway['payment'] ?? [];

        if (!$pagamento) {
            return null;
        }

        return [
            'method' => strtolower($pagamento->forma),
            'status' => $pagamento->status,
            'pix' => $pagamento->forma === 'PIX' ? [
                'encoded_image' => $pix['encodedImage'] ?? null,
                'payload' => $pix['payload'] ?? null,
            ] : null,
            'checkout_url' => $pagamento->forma === 'CARTAO' ? ($payment['link'] ?? null) : null,
        ];
    }

    /**
     * POST /pedir/status/{codigoQr}/avaliacao
     * Cliente avalia o pedido (e, se houve entrega, o entregador junto - mesma nota, ver
     * comentario no model Avaliacao). So pode avaliar pedido ja FINALIZADO, e so uma vez.
     */
    public function avaliar(Request $request, string $codigoQr): JsonResponse
    {
        $pedido = Pedido::with('entrega', 'avaliacao')
            ->where('codigo_qr', $codigoQr)
            ->where('canal_origem', 'ONLINE')
            ->first();

        if (!$pedido) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        if ($pedido->status !== 'FINALIZADO') {
            return response()->json(['message' => 'Esse pedido ainda nao foi finalizado.'], 422);
        }

        if ($pedido->avaliacao) {
            return response()->json(['message' => 'Esse pedido ja foi avaliado.'], 422);
        }

        $data = $request->validate([
            'nota' => ['required', 'integer', 'min:1', 'max:5'],
            'comentario' => ['nullable', 'string', 'max:1000'],
        ]);

        $avaliacao = Avaliacao::create([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $pedido->id_cliente,
            'id_entregador' => $pedido->entrega?->id_entregador,
            'nota' => $data['nota'],
            'ds_comentario' => $data['comentario'] ?? null,
        ]);

        return response()->json([
            'nota' => $avaliacao->nota,
            'comentario' => $avaliacao->ds_comentario,
        ], 201);
    }

    /**
     * POST /pedir/status/{codigoQr}/push/inscrever
     * Cliente autorizou notificacao no navegador enquanto acompanha o pedido - guarda a
     * inscricao (formato padrao PushSubscription.toJSON()) pra poder avisar quando o status
     * mudar, sem precisar ficar com a aba aberta olhando o polling.
     */
    public function inscreverPush(Request $request, string $codigoQr): JsonResponse
    {
        $pedido = Pedido::where('codigo_qr', $codigoQr)
            ->where('canal_origem', 'ONLINE')
            ->first();

        if (!$pedido) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        $data = $request->validate([
            'endpoint' => ['required', 'string'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
        ]);

        PushSubscription::updateOrCreate(
            ['id_pedido' => $pedido->id_pedido, 'endpoint' => $data['endpoint']],
            ['chave_p256dh' => $data['keys']['p256dh'], 'chave_auth' => $data['keys']['auth']],
        );

        return response()->json(['ok' => true], 201);
    }
}
