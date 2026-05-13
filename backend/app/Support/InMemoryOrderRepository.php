<?php

namespace App\Support;

class InMemoryOrderRepository
{
    /** @var array<int, array<string, mixed>>|null */
    private static ?array $orders = null;

    private const STATUSES = [
        'novo',
        'enviado_cozinha',
        'em_preparo',
        'pronto',
        'saiu_entrega',
        'entregue',
        'cancelado',
    ];

    private const TYPES = ['mesa', 'delivery'];

    private static function boot(): void
    {
        if (self::$orders !== null) {
            return;
        }

        self::$orders = [
            1 => [
                'id' => 1,
                'number' => 1001,
                'type' => 'mesa',
                'table_number' => 12,
                'customer_name' => 'Mesa 12',
                'status' => 'novo',
                'total' => 58.50,
                'items' => [
                    ['name' => 'Pizza Calabresa', 'qty' => 1, 'price' => 39.90],
                    ['name' => 'Refrigerante Lata', 'qty' => 2, 'price' => 9.30],
                ],
                'created_at' => '2026-05-12 10:10:00',
            ],
            2 => [
                'id' => 2,
                'number' => 1002,
                'type' => 'delivery',
                'table_number' => null,
                'customer_name' => 'Joao Silva',
                'address' => 'Rua A, 123 - Centro',
                'status' => 'enviado_cozinha',
                'total' => 72.00,
                'items' => [
                    ['name' => 'Lanche X', 'qty' => 2, 'price' => 18.00],
                    ['name' => 'Batata Media', 'qty' => 1, 'price' => 12.00],
                    ['name' => 'Suco', 'qty' => 2, 'price' => 12.00],
                ],
                'created_at' => '2026-05-12 10:22:00',
            ],
        ];
    }

    /** @return array<string> */
    public function statuses(): array
    {
        return self::STATUSES;
    }

    /** @return array<string> */
    public function types(): array
    {
        return self::TYPES;
    }

    /** @param array{status?: string|null, type?: string|null} $filters
     *  @return array<string, mixed>
     */
    public function paginate(int $perPage, int $page, array $filters = []): array
    {
        self::boot();

        $items = array_values(self::$orders);
        $status = $filters['status'] ?? null;
        $type = $filters['type'] ?? null;

        if ($status) {
            $items = array_values(array_filter($items, fn (array $order) => $order['status'] === $status));
        }

        if ($type) {
            $items = array_values(array_filter($items, fn (array $order) => $order['type'] === $type));
        }

        $total = count($items);
        $page = max(1, $page);
        $offset = ($page - 1) * $perPage;

        return [
            'data' => array_slice($items, $offset, $perPage),
            'meta' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil($total / $perPage),
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        self::boot();

        return self::$orders[$id] ?? null;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function create(array $data): array
    {
        self::boot();

        $nextId = empty(self::$orders) ? 1 : (max(array_keys(self::$orders)) + 1);
        $nextNumber = empty(self::$orders)
            ? 1000
            : (max(array_column(self::$orders, 'number')) + 1);

        $data['id'] = $nextId;
        $data['number'] = $nextNumber;
        $data['status'] = $data['status'] ?? 'novo';
        $data['created_at'] = $data['created_at'] ?? date('Y-m-d H:i:s');

        self::$orders[$nextId] = $data;

        return $data;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>|null
     */
    public function update(int $id, array $data): ?array
    {
        self::boot();

        if (!isset(self::$orders[$id])) {
            return null;
        }

        self::$orders[$id] = array_merge(self::$orders[$id], $data);

        return self::$orders[$id];
    }

    public function updateStatus(int $id, string $status): array
    {
        self::boot();

        $order = self::$orders[$id] ?? null;

        if (!$order) {
            return ['error' => 'not_found'];
        }

        if (!$this->canTransition($order, $status)) {
            return ['error' => 'invalid_transition', 'order' => $order];
        }

        $order['status'] = $status;
        self::$orders[$id] = $order;

        return ['order' => $order];
    }

    /** @param array<string, mixed> $order */
    private function canTransition(array $order, string $to): bool
    {
        $from = $order['status'];

        if (!in_array($to, self::STATUSES, true)) {
            return false;
        }

        if ($from === $to) {
            return true;
        }

        $flow = [
            'novo' => ['enviado_cozinha', 'cancelado'],
            'enviado_cozinha' => ['em_preparo', 'cancelado'],
            'em_preparo' => ['pronto', 'cancelado'],
            'pronto' => ['saiu_entrega', 'entregue', 'cancelado'],
            'saiu_entrega' => ['entregue', 'cancelado'],
            'entregue' => [],
            'cancelado' => [],
        ];

        if (!in_array($to, $flow[$from] ?? [], true)) {
            return false;
        }

        if ($order['type'] === 'mesa' && $to === 'saiu_entrega') {
            return false;
        }

        return true;
    }
}
