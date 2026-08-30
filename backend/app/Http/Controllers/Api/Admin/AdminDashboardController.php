<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use App\Models\Cliente;
use App\Models\DashboardSnapshot;
use App\Models\Entrega;
use App\Models\Entregador;
use App\Models\Ingrediente;
use App\Models\ItemPedido;
use App\Models\Mesa;
use App\Models\MesaFilaEspera;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $orders = Pedido::with(['cliente.usuario', 'mesa', 'itens.produto', 'entrega.entregador.usuario'])
            ->orderByDesc('dt_pedido')
            ->get();

        $users = User::whereIn('perfil', ['ADMIN', 'GERENTE', 'ENTREGADOR', 'ATENDENTE'])->get();
        $tables = Mesa::with(['pedidos' => fn ($query) => $query->orderByDesc('dt_pedido')])->orderBy('nr_mesa')->get();
        $payments = Pagamento::with('pedido.mesa', 'pedido.cliente.usuario')->orderByDesc('dt_cadastro')->get();
        $couriers = Entregador::with(['usuario', 'avaliacoes', 'entregas' => fn ($query) => $query->orderByDesc('dt_atualizacao')])->get();
        $companyId = (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');
        $waitingList = $this->buildWaitingList($companyId);

        $tablesSnapshot = $this->snapshot('tables');
        $financeSnapshot = $this->snapshot('finance');
        $reportsSnapshot = $this->snapshot('reports');
        $marketplaceSnapshot = $this->snapshot('marketplace');
        $whatsAppSnapshot = $this->snapshot('whatsapp');

        return response()->json([
            'panelData' => [
                'alerts' => $this->buildAlerts($companyId),
                'channels' => $this->buildChannelSummary($orders),
                'timeline' => $this->buildTimeline($orders),
            ],
            'kitchenData' => [
                'stations' => $this->buildKitchenStations($orders, $companyId),
                'prepList' => $this->buildPrepList($orders),
            ],
            'tablesData' => [
                'summary' => $this->buildTableSummary($tables, $tablesSnapshot, count($waitingList)),
                'areas' => $this->buildTableAreas($tables),
                'waitingList' => $waitingList,
            ],
            'deliveryData' => [
                'couriers' => $this->buildCouriers($couriers),
                'routes' => $this->buildRoutes($orders),
                'incidents' => $this->buildDeliveryIncidents($orders),
            ],
            'financeData' => [
                'kpis' => $this->buildFinanceKpis($payments),
                'cashFlow' => $this->buildCashFlow($payments),
                'paymentMethods' => $this->buildPaymentMethods($payments),
                'pendingPayments' => $this->buildPendingPayments($payments),
                'checklist' => $this->buildChecklist($financeSnapshot),
            ],
            'reportsData' => [
                'cards' => $this->buildReportCards($orders, $payments),
                'topProducts' => $this->buildTopProducts(),
                'exports' => $reportsSnapshot['exports'] ?? [],
            ],
            'customersData' => [
                'segments' => $this->buildCustomerSegments(),
                'spotlight' => $this->buildCustomerSpotlight(),
                'campaigns' => $this->buildCustomerCampaigns(),
            ],
            'marketplaceData' => $marketplaceSnapshot,
            'whatsappData' => $whatsAppSnapshot,
        ]);
    }

    /**
     * GET /admin/relatorios/export
     * Exporta os pedidos reais em CSV (separador ; pra abrir certo no Excel PT-BR, com BOM
     * UTF-8 pra acentuacao nao quebrar).
     */
    public function exportarRelatorio(): StreamedResponse
    {
        $companyId = (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');

        $pedidos = Pedido::with(['cliente.usuario', 'pagamento'])
            ->where('id_empresa', $companyId)
            ->orderByDesc('dt_pedido')
            ->get();

        $filename = 'relatorio-pedidos-' . now()->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($pedidos) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Pedido', 'Data', 'Tipo', 'Canal', 'Cliente', 'Status', 'Forma de pagamento', 'Total', 'Taxa de entrega'], ';');

            foreach ($pedidos as $pedido) {
                fputcsv($handle, [
                    $pedido->id_pedido,
                    optional($pedido->dt_pedido)->format('d/m/Y H:i'),
                    $pedido->tipo_pedido,
                    $pedido->canal_origem,
                    $pedido->cliente?->usuario?->nm_usuario ?? 'Cliente',
                    $pedido->status,
                    $pedido->pagamento?->forma ?? '-',
                    number_format((float) $pedido->vl_total, 2, ',', '.'),
                    number_format((float) $pedido->vl_taxa_entrega, 2, ',', '.'),
                ], ';');
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function snapshot(string $slug): array
    {
        return DashboardSnapshot::query()->where('slug', $slug)->value('payload_json') ?? [];
    }

    private const STATUS_LABELS_TIMELINE = [
        'PENDENTE' => 'Novo pedido',
        'CONFIRMADO' => 'Enviado pra cozinha',
        'PREPARANDO' => 'Em preparo',
        'PRONTO' => 'Pronto',
        'ENTREGANDO' => 'Saiu para entrega',
        'FINALIZADO' => 'Finalizado',
        'CANCELADO' => 'Cancelado',
    ];

    /**
     * Alertas reais: ingrediente com estoque baixo (mesmo limite usado em
     * AdminEstoqueController::LIMITE_ESTOQUE_BAIXO) e pedido parado ha mais de 15 min sem
     * confirmacao da cozinha.
     */
    private function buildAlerts(int $companyId): array
    {
        $alerts = [];

        $ingredientesBaixos = Ingrediente::where('id_empresa', $companyId)
            ->where('qtd_atual', '<=', 5)
            ->orderBy('qtd_atual')
            ->limit(5)
            ->get();

        foreach ($ingredientesBaixos as $ingrediente) {
            $alerts[] = [
                'id' => 'estoque-' . $ingrediente->id_ingrediente,
                'tone' => 'danger',
                'title' => 'Estoque baixo: ' . $ingrediente->nm_ingrediente,
                'description' => 'Restam ' . rtrim(rtrim(number_format((float) $ingrediente->qtd_atual, 3, ',', '.'), '0'), ',') . ' ' . $ingrediente->unidade . '.',
            ];
        }

        $pedidosParados = Pedido::where('id_empresa', $companyId)
            ->where('status', 'PENDENTE')
            ->where('dt_pedido', '<=', now()->subMinutes(15))
            ->orderBy('dt_pedido')
            ->limit(5)
            ->get();

        foreach ($pedidosParados as $pedido) {
            $alerts[] = [
                'id' => 'pendente-' . $pedido->id_pedido,
                'tone' => 'warning',
                'title' => 'Pedido #' . $pedido->id_pedido . ' aguardando confirmacao',
                'description' => 'Esperando ha ' . $pedido->dt_pedido->diffForHumans(null, true) . '.',
            ];
        }

        return $alerts;
    }

    /**
     * Linha do tempo real: ultimas atualizacoes de status dos pedidos de hoje, mais recente
     * primeiro. Nao e um log de auditoria completo (o schema so guarda o status atual, nao
     * o historico de transicoes) - e um retrato de "onde cada pedido esta agora".
     */
    private function buildTimeline(Collection $orders): array
    {
        return $orders
            ->filter(fn (Pedido $order) => $order->dt_atualizacao?->isToday())
            ->sortByDesc('dt_atualizacao')
            ->take(10)
            ->map(fn (Pedido $order) => [
                'time' => $order->dt_atualizacao->format('H:i'),
                'title' => 'Pedido #' . $order->id_pedido . ' - ' . (self::STATUS_LABELS_TIMELINE[$order->status] ?? $order->status),
                'detail' => ($order->cliente?->usuario?->nm_usuario ?? 'Cliente') . ' - ' . $this->money((float) $order->vl_total),
            ])
            ->values()
            ->all();
    }

    private function buildChannelSummary(Collection $orders): array
    {
        $labels = [
            'MESA' => 'Salao',
            'DELIVERY' => 'Delivery',
            'BALCAO' => 'Balcao',
        ];

        return $orders
            ->groupBy('tipo_pedido')
            ->map(function (Collection $group, string $type) use ($labels) {
                $count = $group->count();
                $revenue = (float) $group->sum('vl_total');

                return [
                    'id' => strtolower($type),
                    'label' => $labels[$type] ?? $type,
                    'orders' => $count,
                    'revenue' => round($revenue, 2),
                    'delta' => sprintf('+%d%%', max(1, min(99, $count * 7))),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * "Estacoes" da cozinha nao existem no schema (nao ha tabela de estacao/equipe), entao
     * usamos a categoria do produto como agrupador - e o unico eixo real disponivel. Cada
     * card mostra: tempo medio de preparo configurado nos produtos ativos da categoria, quantos
     * itens dessa categoria estao na fila agora (pedidos CONFIRMADO/PREPARANDO) e quantos
     * produtos ativos ela tem.
     */
    private function buildKitchenStations(Collection $orders, int $companyId): array
    {
        $categorias = Categoria::where('id_empresa', $companyId)
            ->where('fl_ativa', true)
            ->orderBy('nr_ordem')
            ->get();

        $tempoMedioPorCategoria = Produto::where('id_empresa', $companyId)
            ->where('fl_ativo', true)
            ->selectRaw('id_categoria, AVG(tempo_preparo_min) as media, COUNT(*) as total')
            ->groupBy('id_categoria')
            ->get()
            ->keyBy('id_categoria');

        $itensNaFilaPorCategoria = $orders
            ->whereIn('status', ['CONFIRMADO', 'PREPARANDO'])
            ->flatMap(fn (Pedido $order) => $order->itens)
            ->groupBy(fn (ItemPedido $item) => $item->produto?->id_categoria)
            ->map(fn (Collection $itens) => $itens->sum('nr_quantidade'));

        return $categorias
            ->filter(fn (Categoria $categoria) => isset($tempoMedioPorCategoria[$categoria->id_categoria]))
            ->map(function (Categoria $categoria) use ($tempoMedioPorCategoria, $itensNaFilaPorCategoria) {
                $info = $tempoMedioPorCategoria[$categoria->id_categoria];

                return [
                    'id' => $categoria->id_categoria,
                    'name' => $categoria->nm_categoria,
                    'leadTime' => round($info->media) . ' min (medio)',
                    'load' => ($itensNaFilaPorCategoria[$categoria->id_categoria] ?? 0) . ' na fila',
                    'team' => $info->total . ' produto(s) no cardapio',
                ];
            })
            ->values()
            ->all();
    }

    /**
     * "Mise en place": o que preparar com prioridade agora, com base na demanda real dos
     * pedidos que ja estao na cozinha (CONFIRMADO/PREPARANDO) - nao inventa itens, so ordena
     * os produtos pedidos pela quantidade total pendente.
     */
    private function buildPrepList(Collection $orders): array
    {
        $porProduto = $orders
            ->whereIn('status', ['CONFIRMADO', 'PREPARANDO'])
            ->flatMap(fn (Pedido $order) => $order->itens)
            ->groupBy(fn (ItemPedido $item) => $item->produto?->nm_produto ?? 'Item')
            ->map(fn (Collection $itens, string $nome) => [
                'item' => $nome,
                'pending' => (int) $itens->sum('nr_quantidade'),
                'note' => $itens->count() . ' pedido(s) aguardando',
            ])
            ->sortByDesc('pending')
            ->take(8)
            ->values();

        return $porProduto->map(fn (array $linha, int $index) => ['id' => $index + 1, ...$linha])->all();
    }

    private function buildTableSummary(Collection $tables, array $snapshot, int $waitingCount): array
    {
        return [
            'total' => $tables->count(),
            'occupied' => $tables->where('status_ocupacao', 'OCUPADA')->count(),
            'reserved' => $tables->where('status_ocupacao', 'RESERVADA')->count(),
            'cleaning' => $snapshot['summary']['cleaning'] ?? 0,
            'waiting' => $waitingCount,
        ];
    }

    /**
     * Fila de espera real: cadastrada pelo garcom/recepcao em `mesa_fila_espera` (ver
     * AdminMesaController), nao inventada. "esperandoHa" e calculado a partir de quando
     * entrou na fila, em vez de tentar prever um ETA que ninguem tem como saber de verdade.
     */
    private function buildWaitingList(int $companyId): array
    {
        return MesaFilaEspera::where('id_empresa', $companyId)
            ->orderBy('dt_cadastro')
            ->get()
            ->map(fn (MesaFilaEspera $entrada) => [
                'id' => $entrada->id_fila_espera,
                'name' => $entrada->nm_cliente,
                'size' => $entrada->nr_pessoas,
                'eta' => 'ha ' . $entrada->dt_cadastro->diffForHumans(null, true),
            ])
            ->values()
            ->all();
    }

    private function buildTableAreas(Collection $tables): array
    {
        $groups = [
            'interno' => [
                'id' => 'interno',
                'name' => 'Salao interno',
                'tables' => [],
            ],
            'varanda' => [
                'id' => 'varanda',
                'name' => 'Varanda',
                'tables' => [],
            ],
        ];

        foreach ($tables as $table) {
            $bucket = $table->nr_mesa >= 10 ? 'varanda' : 'interno';
            $openOrder = $table->pedidos->first(fn ($order) => !in_array($order->status, ['FINALIZADO', 'CANCELADO'], true));

            $groups[$bucket]['tables'][] = [
                'id' => $table->id_mesa,
                'number' => $table->nr_mesa,
                'seats' => $table->capacidade,
                'status' => match ($table->status_ocupacao) {
                    'OCUPADA' => 'occupied',
                    'RESERVADA' => 'reserved',
                    default => 'free',
                },
                'ticket' => $openOrder ? (float) $openOrder->vl_total : 0,
                'waiter' => $openOrder?->cliente?->usuario?->nm_usuario ?? '-',
                'qrToken' => $table->qr_code_token,
            ];
        }

        return array_values(array_filter($groups, fn (array $group) => count($group['tables']) > 0));
    }

    private function buildCouriers(Collection $couriers): array
    {
        return $couriers->map(function (Entregador $courier) {
            $latestDelivery = $courier->entregas->first();
            $route = is_array($latestDelivery?->rota_json) ? $latestDelivery->rota_json : [];
            $deliveries = $courier->entregas->where('status_entrega', 'ENTREGUE')->count();
            $qtdAvaliacoes = $courier->avaliacoes->count();

            return [
                'id' => $courier->id_entregador,
                'name' => $courier->usuario?->nm_usuario ?? 'Entregador',
                'zone' => $route['region'] ?? 'Sem rota',
                'status' => $this->mapCourierStatus($latestDelivery?->status_entrega, $courier->fl_online),
                'deliveries' => $deliveries,
                'rating' => $qtdAvaliacoes > 0 ? round($courier->avaliacoes->avg('nota'), 1) : null,
                'qtdAvaliacoes' => $qtdAvaliacoes,
            ];
        })->values()->all();
    }

    private function buildRoutes(Collection $orders): array
    {
        return $orders
            ->filter(fn (Pedido $order) => $order->tipo_pedido === 'DELIVERY' && $order->entrega)
            ->map(function (Pedido $order) {
                $route = is_array($order->entrega->rota_json) ? $order->entrega->rota_json : [];

                return [
                    'id' => 'rt-' . $order->id_pedido,
                    'region' => $route['region'] ?? ('Pedido #' . $order->id_pedido),
                    'orders' => 1,
                    'distance' => number_format((float) ($order->entrega->distancia_km ?? 0), 1, ',', '.') . ' km',
                    'eta' => (int) ($order->entrega->tempo_estimado_min ?? 0) . ' min',
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Ocorrencias reais: pedido delivery esperando entregador ha mais de 15 min, e pedidos
     * delivery cancelados hoje (com motivo). Sem incidente inventado - lista vazia quando a
     * operacao esta tranquila.
     */
    private function buildDeliveryIncidents(Collection $orders): array
    {
        $incidents = [];

        $semEntregador = $orders->filter(fn (Pedido $order) => $order->tipo_pedido === 'DELIVERY'
            && $order->entrega?->status_entrega === 'AGUARDANDO'
            && !$order->entrega->id_entregador
            && $order->dt_pedido->lte(now()->subMinutes(15)));

        foreach ($semEntregador as $order) {
            $incidents[] = [
                'id' => 'sem-entregador-' . $order->id_pedido,
                'level' => 'warning',
                'title' => 'Pedido #' . $order->id_pedido . ' aguardando motoboy',
                'detail' => 'Sem entregador atribuido ha ' . $order->dt_pedido->diffForHumans(null, true) . '.',
            ];
        }

        $canceladosHoje = $orders->filter(fn (Pedido $order) => $order->tipo_pedido === 'DELIVERY'
            && $order->status === 'CANCELADO'
            && $order->motivo_cancelamento
            && $order->dt_atualizacao?->isToday());

        foreach ($canceladosHoje as $order) {
            $incidents[] = [
                'id' => 'cancelado-' . $order->id_pedido,
                'level' => 'danger',
                'title' => 'Pedido #' . $order->id_pedido . ' cancelado',
                'detail' => $order->motivo_cancelamento,
            ];
        }

        return $incidents;
    }

    /**
     * Marca do checklist e por dia - vira "desmarcado" de novo no dia seguinte, mesmo sem
     * apagar o registro. Guardado em dashboard_snapshots (slug 'finance') porque e so um
     * estado de UI (o que o operador ja conferiu hoje), nao dado de negocio.
     */
    private function buildChecklist(array $financeSnapshot): array
    {
        $itens = $financeSnapshot['checklist'] ?? [];
        $estado = $financeSnapshot['checklist_state'] ?? [];
        $marcadosHoje = ($estado['date'] ?? null) === now()->toDateString() ? ($estado['checked'] ?? []) : [];

        return collect($itens)
            ->map(fn (string $label, int $index) => [
                'id' => $index,
                'label' => $label,
                'checked' => (bool) ($marcadosHoje[(string) $index] ?? false),
            ])
            ->values()
            ->all();
    }

    /**
     * PATCH /admin/financeiro/checklist
     */
    public function atualizarChecklist(Request $request): JsonResponse
    {
        $data = $request->validate([
            'item_id' => ['required', 'integer', 'min:0'],
            'checked' => ['required', 'boolean'],
        ]);

        $snapshot = DashboardSnapshot::firstOrCreate(['slug' => 'finance'], ['payload_json' => []]);
        $payload = $snapshot->payload_json ?? [];
        $hoje = now()->toDateString();

        $marcadosHoje = (($payload['checklist_state']['date'] ?? null) === $hoje)
            ? ($payload['checklist_state']['checked'] ?? [])
            : [];

        $marcadosHoje[(string) $data['item_id']] = $data['checked'];
        $payload['checklist_state'] = ['date' => $hoje, 'checked' => $marcadosHoje];

        $snapshot->update(['payload_json' => $payload]);

        return response()->json(['ok' => true]);
    }

    private function buildFinanceKpis(Collection $payments): array
    {
        $gross = (float) $payments->sum('vl_total');
        $net = (float) $payments->sum('vl_final');
        $pending = $payments->where('status', 'PENDENTE');

        return [
            ['id' => 'gross', 'label' => 'Faturamento bruto', 'value' => $this->money($gross), 'tone' => 'success'],
            ['id' => 'net', 'label' => 'Liquido previsto', 'value' => $this->money($net), 'tone' => 'info'],
            ['id' => 'payable', 'label' => 'Pagamentos pendentes', 'value' => $this->money((float) $pending->sum('vl_total')), 'tone' => 'warning'],
            ['id' => 'receivable', 'label' => 'Contas a receber', 'value' => $this->money((float) $pending->sum('vl_final')), 'tone' => 'sun'],
        ];
    }

    /**
     * Detalhe por tras do KPI "Pagamentos pendentes": pra cada pagamento ainda PENDENTE,
     * de onde ele vem (mesa/delivery/balcao) e o numero do pedido, pra dar pra clicar e
     * abrir o pedido direto em Pedidos sem precisar procurar na mao.
     */
    private function buildPendingPayments(Collection $payments): array
    {
        return $payments
            ->where('status', 'PENDENTE')
            ->filter(fn (Pagamento $payment) => $payment->pedido !== null)
            ->map(function (Pagamento $payment) {
                $pedido = $payment->pedido;

                return [
                    'id_pedido' => $pedido->id_pedido,
                    'number' => $pedido->id_pedido,
                    'delivery_number' => $pedido->nr_pedido_delivery,
                    'type' => strtolower($pedido->tipo_pedido),
                    'table_number' => $pedido->mesa?->nr_mesa,
                    'customer_name' => $pedido->cliente?->usuario?->nm_usuario ?? 'Cliente',
                    'value' => (float) $payment->vl_final,
                ];
            })
            ->sortByDesc('id_pedido')
            ->values()
            ->all();
    }

    private function buildCashFlow(Collection $payments): array
    {
        return $payments->take(10)->map(function (Pagamento $payment) {
            return [
                'id' => $payment->id_pagamento,
                'type' => match ($payment->status) {
                    'APROVADO' => 'Entrada',
                    'CANCELADO' => 'Cancelado',
                    default => 'Pendente',
                },
                'description' => 'Pedido #' . $payment->id_pedido,
                'method' => $payment->forma,
                'value' => $this->money((float) $payment->vl_final),
            ];
        })->values()->all();
    }

    private function buildPaymentMethods(Collection $payments): array
    {
        $total = max(1, (float) $payments->sum('vl_final'));

        return $payments
            ->groupBy('forma')
            ->map(function (Collection $group, string $forma) use ($total) {
                $amount = (float) $group->sum('vl_final');

                return [
                    'id' => strtolower($forma),
                    'label' => $forma,
                    'share' => round(($amount / $total) * 100) . '%',
                    'amount' => $this->money($amount),
                ];
            })
            ->values()
            ->all();
    }

    private function buildReportCards(Collection $orders, Collection $payments): array
    {
        $gross = (float) $payments->sum('vl_total');
        $net = (float) $payments->sum('vl_final');
        $margin = $gross > 0 ? (($net / $gross) * 100) : 0;
        $bestType = $orders->groupBy('tipo_pedido')->sortByDesc->count()->keys()->first() ?? 'MESA';
        $pending = $payments->where('status', 'PENDENTE')->count();

        return [
            [
                'id' => 'dre',
                'title' => 'DRE simplificado',
                'detail' => 'Margem operacional em ' . number_format($margin, 1, ',', '.') . '%',
                'period' => 'Periodo atual',
            ],
            [
                'id' => 'sales',
                'title' => 'Curva de vendas',
                'detail' => 'Canal com maior volume: ' . ucfirst(strtolower($bestType)),
                'period' => 'Periodo atual',
            ],
            [
                'id' => 'default',
                'title' => 'Inadimplencia',
                'detail' => $pending . ' pagamento(s) pendente(s)',
                'period' => 'Periodo atual',
            ],
        ];
    }

    private function buildTopProducts(): array
    {
        return ItemPedido::query()
            ->select([
                'produto.nm_produto as name',
                DB::raw('SUM(item_pedido.nr_quantidade) as orders'),
                DB::raw('SUM(item_pedido.vl_subtotal) as revenue'),
                DB::raw('MIN(item_pedido.id_item_pedido) as id'),
            ])
            ->join('produto', 'produto.id_produto', '=', 'item_pedido.id_produto')
            ->groupBy('produto.nm_produto')
            ->orderByDesc('orders')
            ->limit(5)
            ->get()
            ->map(fn ($product) => [
                'id' => (int) $product->id,
                'name' => $product->name,
                'orders' => (int) $product->orders,
                'revenue' => $this->money((float) $product->revenue),
            ])
            ->all();
    }

    private function buildCustomerSegments(): array
    {
        $stats = Cliente::query()
            ->select([
                'cliente.id_cliente',
                'usuario.nm_usuario as name',
                DB::raw('COUNT(pedido.id_pedido) as orders_count'),
                DB::raw('COALESCE(AVG(pedido.vl_total), 0) as average_total'),
            ])
            ->join('usuario', 'usuario.id_usuario', '=', 'cliente.id_usuario')
            ->leftJoin('pedido', 'pedido.id_cliente', '=', 'cliente.id_cliente')
            ->groupBy('cliente.id_cliente', 'usuario.nm_usuario')
            ->get();

        $vip = $stats->where('orders_count', '>=', 3);
        $regular = $stats->where('orders_count', '>=', 2)->where('orders_count', '<', 3);
        $new = $stats->where('orders_count', '<=', 1);

        $clientesDoSegmento = fn (Collection $grupo) => $grupo
            ->sortByDesc('orders_count')
            ->map(fn ($c) => [
                'id' => $c->id_cliente,
                'nome' => $c->name,
                'pedidos' => (int) $c->orders_count,
                'ticketMedio' => $this->money((float) $c->average_total),
            ])
            ->values()
            ->all();

        return [
            [
                'id' => 'vip',
                'name' => 'VIP',
                'customers' => $vip->count(),
                'average' => $this->money((float) $vip->avg('average_total')),
                'note' => 'Clientes com 3 ou mais pedidos.',
                'clientes' => $clientesDoSegmento($vip),
            ],
            [
                'id' => 'regular',
                'name' => 'Frequentes',
                'customers' => $regular->count(),
                'average' => $this->money((float) $regular->avg('average_total')),
                'note' => 'Clientes com recorrencia moderada.',
                'clientes' => $clientesDoSegmento($regular),
            ],
            [
                'id' => 'new',
                'name' => 'Novos',
                'customers' => $new->count(),
                'average' => $this->money((float) $new->avg('average_total')),
                'note' => 'Primeiras compras ou baixa recorrencia.',
                'clientes' => $clientesDoSegmento($new),
            ],
        ];
    }

    private function buildCustomerSpotlight(): array
    {
        $customers = Cliente::query()
            ->with(['usuario', 'pedidos.itens.produto'])
            ->get()
            ->map(function (Cliente $customer) {
                $favorite = $customer->pedidos
                    ->flatMap->itens
                    ->groupBy(fn ($item) => $item->produto?->nm_produto ?? 'Item')
                    ->sortByDesc(fn (Collection $items) => $items->sum('nr_quantidade'))
                    ->keys()
                    ->first() ?? '-';

                $lastOrder = $customer->pedidos->sortByDesc('dt_pedido')->first();

                return [
                    'id' => $customer->id_cliente,
                    'name' => $customer->usuario?->nm_usuario ?? 'Cliente',
                    'orders' => $customer->pedidos->count(),
                    'favorite' => $favorite,
                    'lastOrder' => $lastOrder?->dt_pedido?->format('d/m H:i') ?? 'Sem pedidos',
                ];
            })
            ->sortByDesc('orders')
            ->take(5)
            ->values();

        return $customers->all();
    }

    /**
     * "Campanhas" reais: nao existe sistema de cupom nem aniversario cadastrado, entao em vez
     * de inventar acao de marketing, isso vira segmentos reais e acionaveis a partir do
     * historico de pedidos - quantos clientes estao em cada situacao agora.
     */
    private function buildCustomerCampaigns(): array
    {
        $customers = Cliente::with('pedidos')->get();
        $hoje = now();

        $inativos = $customers->filter(function (Cliente $cliente) use ($hoje) {
            $ultimoPedido = $cliente->pedidos->max('dt_pedido');
            return $ultimoPedido && $hoje->diffInDays($ultimoPedido) > 30;
        });

        $novosNaSemana = $customers->filter(function (Cliente $cliente) use ($hoje) {
            $primeiroPedido = $cliente->pedidos->min('dt_pedido');
            return $primeiroPedido && $hoje->diffInDays($primeiroPedido) <= 7;
        });

        $recorrentes = $customers->filter(fn (Cliente $cliente) => $cliente->pedidos->count() >= 3);

        $campanhas = [];

        if ($inativos->isNotEmpty()) {
            $campanhas[] = $inativos->count() . ' cliente(s) sem pedido ha mais de 30 dias - bom momento pra reativar.';
        }

        if ($novosNaSemana->isNotEmpty()) {
            $campanhas[] = $novosNaSemana->count() . ' cliente(s) novo(s) essa semana - primeira impressao conta.';
        }

        if ($recorrentes->isNotEmpty()) {
            $campanhas[] = $recorrentes->count() . ' cliente(s) fiel(is) com 3 ou mais pedidos - candidatos a um agradecimento.';
        }

        return $campanhas;
    }

    private function mapCourierStatus(?string $status, bool $isOnline): string
    {
        if (!$isOnline) {
            return 'Offline';
        }

        return match ($status) {
            'EM_ROTA' => 'Em rota',
            'COLETADO' => 'Aguardando coleta',
            'ENTREGUE' => 'Retornando',
            default => 'Disponivel',
        };
    }

    private function money(float $value): string
    {
        return 'R$ ' . number_format($value, 2, ',', '.');
    }
}
