<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\DashboardSnapshot;
use App\Models\Entrega;
use App\Models\Entregador;
use App\Models\ItemPedido;
use App\Models\Mesa;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $orders = Pedido::with(['cliente.usuario', 'mesa', 'itens.produto', 'entrega.entregador.usuario'])
            ->orderByDesc('dt_pedido')
            ->get();

        $users = User::whereIn('perfil', ['ADMIN', 'GERENTE', 'ENTREGADOR', 'ATENDENTE'])->get();
        $tables = Mesa::with(['pedidos' => fn ($query) => $query->orderByDesc('dt_pedido')])->orderBy('nr_mesa')->get();
        $payments = Pagamento::with('pedido')->orderByDesc('dt_cadastro')->get();
        $couriers = Entregador::with(['usuario', 'entregas' => fn ($query) => $query->orderByDesc('dt_atualizacao')])->get();

        $panelSnapshot = $this->snapshot('panel');
        $kitchenSnapshot = $this->snapshot('kitchen');
        $tablesSnapshot = $this->snapshot('tables');
        $deliverySnapshot = $this->snapshot('delivery');
        $financeSnapshot = $this->snapshot('finance');
        $reportsSnapshot = $this->snapshot('reports');
        $customersSnapshot = $this->snapshot('customers');
        $marketplaceSnapshot = $this->snapshot('marketplace');
        $whatsAppSnapshot = $this->snapshot('whatsapp');

        return response()->json([
            'panelData' => [
                'alerts' => $panelSnapshot['alerts'] ?? [],
                'channels' => $this->buildChannelSummary($orders),
                'timeline' => $panelSnapshot['timeline'] ?? [],
            ],
            'kitchenData' => [
                'stations' => $kitchenSnapshot['stations'] ?? [],
                'prepList' => $kitchenSnapshot['prepList'] ?? [],
            ],
            'tablesData' => [
                'summary' => $this->buildTableSummary($tables, $tablesSnapshot),
                'areas' => $this->buildTableAreas($tables),
                'waitingList' => $tablesSnapshot['waitingList'] ?? [],
            ],
            'deliveryData' => [
                'couriers' => $this->buildCouriers($couriers),
                'routes' => $this->buildRoutes($orders),
                'incidents' => $deliverySnapshot['incidents'] ?? [],
            ],
            'financeData' => [
                'kpis' => $this->buildFinanceKpis($payments),
                'cashFlow' => $this->buildCashFlow($payments),
                'paymentMethods' => $this->buildPaymentMethods($payments),
                'checklist' => $financeSnapshot['checklist'] ?? [],
            ],
            'reportsData' => [
                'cards' => $this->buildReportCards($orders, $payments),
                'topProducts' => $this->buildTopProducts(),
                'exports' => $reportsSnapshot['exports'] ?? [],
            ],
            'customersData' => [
                'segments' => $this->buildCustomerSegments(),
                'spotlight' => $this->buildCustomerSpotlight(),
                'campaigns' => $customersSnapshot['campaigns'] ?? [],
            ],
            'marketplaceData' => $marketplaceSnapshot,
            'whatsappData' => $whatsAppSnapshot,
        ]);
    }

    private function snapshot(string $slug): array
    {
        return DashboardSnapshot::query()->where('slug', $slug)->value('payload_json') ?? [];
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

    private function buildTableSummary(Collection $tables, array $snapshot): array
    {
        return [
            'total' => $tables->count(),
            'occupied' => $tables->where('status_ocupacao', 'OCUPADA')->count(),
            'reserved' => $tables->where('status_ocupacao', 'RESERVADA')->count(),
            'cleaning' => $snapshot['summary']['cleaning'] ?? 0,
            'waiting' => count($snapshot['waitingList'] ?? []),
        ];
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

            return [
                'id' => $courier->id_entregador,
                'name' => $courier->usuario?->nm_usuario ?? 'Entregador',
                'zone' => $route['region'] ?? 'Sem rota',
                'status' => $this->mapCourierStatus($latestDelivery?->status_entrega, $courier->fl_online),
                'deliveries' => $deliveries,
                'rating' => $deliveries > 0 ? round(min(5, 4.5 + ($deliveries * 0.05)), 1) : 4.5,
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

    private function buildCashFlow(Collection $payments): array
    {
        return $payments->take(10)->map(function (Pagamento $payment) {
            return [
                'id' => $payment->id_pagamento,
                'type' => $payment->status === 'APROVADO' ? 'Entrada' : 'Pendente',
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

        return [
            [
                'id' => 'vip',
                'name' => 'VIP',
                'customers' => $vip->count(),
                'average' => $this->money((float) $vip->avg('average_total')),
                'note' => 'Clientes com 3 ou mais pedidos.',
            ],
            [
                'id' => 'regular',
                'name' => 'Frequentes',
                'customers' => $regular->count(),
                'average' => $this->money((float) $regular->avg('average_total')),
                'note' => 'Clientes com recorrencia moderada.',
            ],
            [
                'id' => 'new',
                'name' => 'Novos',
                'customers' => $new->count(),
                'average' => $this->money((float) $new->avg('average_total')),
                'note' => 'Primeiras compras ou baixa recorrencia.',
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
