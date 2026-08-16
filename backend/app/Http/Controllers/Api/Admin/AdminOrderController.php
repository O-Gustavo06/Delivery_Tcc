<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Entrega;
use App\Models\Mesa;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminOrderController extends Controller
{
    private const FRONT_TO_DB_PAYMENT = [
        'pix' => 'PIX',
        'cartao' => 'CARTAO',
        'dinheiro' => 'DINHEIRO',
    ];

    private const DB_TO_FRONT_PAYMENT = [
        'PIX' => 'pix',
        'CARTAO' => 'cartao',
        'DINHEIRO' => 'dinheiro',
    ];

    private const FRONT_TO_DB_CHANNEL = [
        'loja' => 'LOJA',
        'ifood' => 'IFOOD',
        '99food' => '99FOOD',
    ];

    private const DB_TO_FRONT_CHANNEL = [
        'LOJA' => 'loja',
        'IFOOD' => 'ifood',
        '99FOOD' => '99food',
        'ONLINE' => 'online',
    ];

    /** Canais externos: a gente nao tem integracao real com a API deles,
     * entao simulamos gerando um codigo de confirmacao de entrega,
     * do jeito que o app do iFood/99Food mostraria pro cliente. */
    private const CANAIS_EXTERNOS = ['IFOOD', '99FOOD'];

    private const FRONT_TO_DB_STATUS = [
        'novo' => 'PENDENTE',
        'enviado_cozinha' => 'CONFIRMADO',
        'em_preparo' => 'PREPARANDO',
        'pronto' => 'PRONTO',
        'saiu_entrega' => 'ENTREGANDO',
        'entregue' => 'FINALIZADO',
        'cancelado' => 'CANCELADO',
    ];

    private const DB_TO_FRONT_STATUS = [
        'PENDENTE' => 'novo',
        'CONFIRMADO' => 'enviado_cozinha',
        'PREPARANDO' => 'em_preparo',
        'PRONTO' => 'pronto',
        'ENTREGANDO' => 'saiu_entrega',
        'FINALIZADO' => 'entregue',
        'CANCELADO' => 'cancelado',
    ];

    private const FRONT_TO_DB_TYPE = [
        'mesa' => 'MESA',
        'delivery' => 'DELIVERY',
        'balcao' => 'BALCAO',
    ];

    private const DB_TO_FRONT_TYPE = [
        'MESA' => 'mesa',
        'DELIVERY' => 'delivery',
        'BALCAO' => 'balcao',
    ];

    public function index(Request $request): JsonResponse
    {
        $page = (int) $request->query('page', 1);
        $query = Pedido::with(['cliente.usuario', 'mesa', 'itens.produto', 'entrega', 'pagamento'])
            ->orderByDesc('dt_pedido');

        $status = $request->query('status');
        if ($status && isset(self::FRONT_TO_DB_STATUS[$status])) {
            $query->where('status', self::FRONT_TO_DB_STATUS[$status]);
        }

        $type = $request->query('type');
        if ($type && isset(self::FRONT_TO_DB_TYPE[$type])) {
            $query->where('tipo_pedido', self::FRONT_TO_DB_TYPE[$type]);
        }

        $orders = $query->paginate(20, ['*'], 'page', $page);

        $payload = [
            'data' => $orders->getCollection()->map(fn (Pedido $order) => $this->toPayload($order))->all(),
            'meta' => [
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
            ],
        ];

        return response()->json($payload);
    }

    public function show(string $orderId): JsonResponse
    {
        $order = Pedido::with(['cliente.usuario', 'mesa', 'itens.produto', 'entrega', 'pagamento'])->find((int) $orderId);

        if (!$order) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        return response()->json($this->toPayload($order));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string'],
            'channel' => ['nullable', 'string', 'in:loja,ifood,99food'],
            'table_number' => ['nullable', 'integer', 'min:1'],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:255'],
            'cep' => ['nullable', 'string', 'max:9'],
            'rua' => ['nullable', 'string', 'max:150'],
            'cidade' => ['nullable', 'string', 'max:100'],
            'uf' => ['nullable', 'string', 'max:2'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'payment_method' => ['nullable', 'string', 'in:pix,cartao,dinheiro'],
            'change_for' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
        ]);

        if (!isset(self::FRONT_TO_DB_TYPE[$data['type']])) {
            return response()->json([
                'message' => 'Tipo invalido.',
                'errors' => ['type' => ['Tipo invalido.']],
            ], 422);
        }

        if ($data['type'] === 'mesa' && empty($data['table_number'])) {
            return response()->json([
                'message' => 'Mesa obrigatoria.',
                'errors' => ['table_number' => ['Mesa obrigatoria.']],
            ], 422);
        }

        if ($data['type'] === 'delivery' && empty($data['address'])) {
            return response()->json([
                'message' => 'Endereco obrigatorio.',
                'errors' => ['address' => ['Endereco obrigatorio.']],
            ], 422);
        }

        $canalExterno = in_array($data['channel'] ?? 'loja', ['ifood', '99food'], true);
        $telefoneDigits = preg_replace('/\D/', '', $data['customer_phone'] ?? '');

        if ($canalExterno && strlen($telefoneDigits) < 4) {
            return response()->json([
                'message' => 'Telefone do cliente (com pelo menos 4 digitos) e obrigatorio pra pedidos de iFood/99Food, pra gerar o codigo de confirmacao.',
                'errors' => ['customer_phone' => ['Telefone obrigatorio pra pedidos de canal externo.']],
            ], 422);
        }

        // Coordenada explicita (se algum dia vier) tem prioridade; senao, geocodifica pelo
        // CEP. Fora da transacao porque e uma chamada de rede.
        $latitude = $data['latitude'] ?? null;
        $longitude = $data['longitude'] ?? null;
        if ($data['type'] === 'delivery' && $latitude === null && !empty($data['cep'])) {
            $coordenadas = app(\App\Services\GeocodingService::class)->coordenadasPorEndereco(
                $data['rua'] ?? null,
                $data['cidade'] ?? null,
                $data['uf'] ?? null,
                $data['cep'],
            );
            $latitude = $coordenadas['lat'] ?? null;
            $longitude = $coordenadas['lng'] ?? null;
        }

        $order = DB::transaction(function () use ($data, $telefoneDigits, $latitude, $longitude) {
            $companyId = (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');
            if (!$companyId) {
                abort(422, 'Nenhuma empresa cadastrada para receber pedidos.');
            }

            $customerEmail = strtolower(preg_replace('/\s+/', '.', trim($data['customer_name']))) . '+' . now()->timestamp . '@cliente.local';
            $userId = DB::table('usuario')->insertGetId([
                'nm_usuario' => $data['customer_name'],
                'email' => $customerEmail,
                'senha_hash' => bcrypt('cliente123'),
                'perfil' => 'CLIENTE',
                'fl_ativo' => 1,
                'dt_cadastro' => now(),
                'dt_atualizacao' => now(),
            ]);

            $clientId = DB::table('cliente')->insertGetId([
                'id_usuario' => $userId,
                'telefone' => $data['customer_phone'] ?? null,
                'cpf' => null,
                'dt_cadastro' => now(),
            ]);

            $mesaId = null;
            if ($data['type'] === 'mesa') {
                $mesaId = Mesa::where('nr_mesa', $data['table_number'])->value('id_mesa');
            }

            $total = collect($data['items'])->sum(fn (array $item) => $item['qty'] * $item['price']);
            $canalOrigem = self::FRONT_TO_DB_CHANNEL[$data['channel'] ?? 'loja'];

            // Numeracao propria do delivery, comecando do 1, separada do id_pedido global.
            // O lockForUpdate evita que dois pedidos delivery concorrentes saiam com o mesmo numero.
            $nrPedidoDelivery = null;
            if ($data['type'] === 'delivery') {
                $nrPedidoDelivery = 1 + (int) DB::table('pedido')
                    ->where('tipo_pedido', 'DELIVERY')
                    ->lockForUpdate()
                    ->max('nr_pedido_delivery');
            }

            $orderId = DB::table('pedido')->insertGetId([
                'id_empresa' => $companyId,
                'id_cliente' => $clientId,
                'id_mesa' => $mesaId,
                'codigo_qr' => (string) Str::uuid(),
                'tipo_pedido' => self::FRONT_TO_DB_TYPE[$data['type']],
                'nr_pedido_delivery' => $nrPedidoDelivery,
                'canal_origem' => $canalOrigem,
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_taxa_entrega' => $data['type'] === 'delivery' ? 8 : 0,
                'ds_observacao' => $data['address'] ?? null,
                'dt_pedido' => now(),
                'dt_conclusao' => null,
                'dt_atualizacao' => now(),
            ]);

            $defaultCategoryId = (int) DB::table('categoria')->orderBy('id_categoria')->value('id_categoria');

            foreach ($data['items'] as $item) {
                $productId = Produto::where('nm_produto', $item['name'])->value('id_produto');
                if (!$productId) {
                    $productId = DB::table('produto')->insertGetId([
                        'id_empresa' => $companyId,
                        'id_categoria' => $defaultCategoryId,
                        'nm_produto' => $item['name'],
                        'ds_produto' => $item['name'],
                        'vl_preco_base' => $item['price'],
                        'tempo_preparo_min' => 15,
                        'fl_ativo' => 1,
                        'url_imagem' => null,
                        'dt_cadastro' => now(),
                        'dt_atualizacao' => now(),
                    ]);
                }

                DB::table('item_pedido')->insert([
                    'id_pedido' => $orderId,
                    'id_produto' => $productId,
                    'nr_quantidade' => $item['qty'],
                    'vl_preco_unitario' => $item['price'],
                    'vl_subtotal' => $item['qty'] * $item['price'],
                    'adicionais_json' => null,
                    'dt_cadastro' => now(),
                ]);
            }

            $formaPagamento = self::FRONT_TO_DB_PAYMENT[$data['payment_method'] ?? 'pix'];

            Pagamento::create([
                'id_pedido' => $orderId,
                'forma' => $formaPagamento,
                'troco_para' => $formaPagamento === 'DINHEIRO' ? ($data['change_for'] ?? null) : null,
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_desconto' => 0,
                'vl_final' => round($total, 2),
            ]);

            if ($data['type'] === 'delivery') {
                // Em canal externo (iFood/99Food) o app deles mostra um codigo pro cliente
                // conferir com o motoboy na entrega. Sem a API real, simulamos usando os
                // ultimos 4 digitos do telefone do cliente como codigo de confirmacao.
                $codigoConfirmacao = in_array($canalOrigem, self::CANAIS_EXTERNOS, true)
                    ? substr($telefoneDigits, -4)
                    : null;

                Entrega::create([
                    'id_pedido' => $orderId,
                    'status_entrega' => 'AGUARDANDO',
                    'codigo_confirmacao_entrega' => $codigoConfirmacao,
                    'latitude_destino' => $latitude,
                    'longitude_destino' => $longitude,
                ]);
            }

            if ($mesaId) {
                Mesa::whereKey($mesaId)->update(['status_ocupacao' => 'OCUPADA']);
            }

            return Pedido::with(['cliente.usuario', 'mesa', 'itens.produto', 'entrega', 'pagamento'])->findOrFail($orderId);
        });

        return response()->json($this->toPayload($order), 201);
    }

    public function updateStatus(Request $request, string $orderId): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
            'motivo' => ['nullable', 'string', 'max:255'],
        ]);

        if (!isset(self::FRONT_TO_DB_STATUS[$data['status']])) {
            return response()->json([
                'message' => 'Status invalido.',
                'errors' => ['status' => ['Status invalido.']],
            ], 422);
        }

        $order = Pedido::with(['entrega', 'mesa', 'cliente.usuario', 'itens.produto', 'pagamento'])->find((int) $orderId);
        if (!$order) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        $dbStatus = self::FRONT_TO_DB_STATUS[$data['status']];
        $order->status = $dbStatus;
        $order->dt_conclusao = in_array($dbStatus, ['FINALIZADO', 'CANCELADO'], true) ? now() : null;
        $order->motivo_cancelamento = $dbStatus === 'CANCELADO' ? ($data['motivo'] ?? null) : null;
        $order->save();

        if ($order->mesa) {
            $order->mesa->update([
                'status_ocupacao' => in_array($dbStatus, ['FINALIZADO', 'CANCELADO'], true) ? 'LIVRE' : 'OCUPADA',
            ]);
        }

        $statusEntrega = match ($dbStatus) {
            'ENTREGANDO' => 'EM_ROTA',
            'FINALIZADO' => 'ENTREGUE',
            'CANCELADO' => 'CANCELADA',
            default => null,
        };

        // Só mexe na entrega nas transições que de fato dizem respeito a ela;
        // outros status (ex: preparo na cozinha) não devem sobrescrever o progresso do motoboy.
        if ($order->entrega && $statusEntrega) {
            $order->entrega->update(['status_entrega' => $statusEntrega]);
        }

        return response()->json($this->toPayload($order->fresh(['cliente.usuario', 'mesa', 'itens.produto', 'entrega', 'pagamento'])));
    }

    public function sendToKitchen(string $orderId): JsonResponse
    {
        $request = new Request(['status' => 'enviado_cozinha']);

        return $this->updateStatus($request, $orderId);
    }

    private function toPayload(Pedido $order): array
    {
        return [
            'id' => $order->id_pedido,
            'number' => $order->id_pedido,
            'delivery_number' => $order->nr_pedido_delivery,
            'type' => self::DB_TO_FRONT_TYPE[$order->tipo_pedido] ?? 'delivery',
            'channel' => self::DB_TO_FRONT_CHANNEL[$order->canal_origem] ?? 'loja',
            'table_number' => $order->mesa?->nr_mesa,
            'customer_name' => $order->cliente?->usuario?->nm_usuario ?? 'Cliente',
            'customer_phone' => $order->cliente?->telefone,
            'address' => $order->tipo_pedido === 'DELIVERY' ? $order->ds_observacao : null,
            'status' => self::DB_TO_FRONT_STATUS[$order->status] ?? 'novo',
            'motivo_cancelamento' => $order->motivo_cancelamento,
            'total' => (float) $order->vl_total,
            'codigo_qr' => $order->codigo_qr,
            'confirmation_code' => $order->entrega?->codigo_confirmacao_entrega,
            'payment_method' => self::DB_TO_FRONT_PAYMENT[$order->pagamento?->forma] ?? null,
            'change_for' => $order->pagamento?->troco_para !== null ? (float) $order->pagamento->troco_para : null,
            'items' => $order->itens->map(fn ($item) => [
                'name' => $item->produto?->nm_produto ?? 'Item',
                'qty' => (int) $item->nr_quantidade,
                'price' => (float) $item->vl_preco_unitario,
            ])->values()->all(),
            'created_at' => optional($order->dt_pedido)->format('Y-m-d H:i:s'),
        ];
    }
}
