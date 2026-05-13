<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\InMemoryOrderRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminOrderController extends Controller
{
    public function __construct(private readonly InMemoryOrderRepository $orders)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $page = (int) $request->query('page', 1);
        $filters = [
            'status' => $request->query('status'),
            'type' => $request->query('type'),
        ];

        $payload = $this->orders->paginate(20, $page, $filters);

        return response()->json($payload);
    }

    public function show(string $orderId): JsonResponse
    {
        $order = $this->orders->findById((int) $orderId);

        if (!$order) {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        return response()->json($order);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string'],
            'table_number' => ['nullable', 'integer', 'min:1'],
            'customer_name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
        ]);

        if (!in_array($data['type'], $this->orders->types(), true)) {
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

        $total = 0;
        foreach ($data['items'] as $item) {
            $total += $item['qty'] * $item['price'];
        }

        $data['total'] = round($total, 2);
        $data['status'] = 'novo';

        $order = $this->orders->create($data);

        return response()->json($order, 201);
    }

    public function updateStatus(Request $request, string $orderId): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
        ]);

        if (!in_array($data['status'], $this->orders->statuses(), true)) {
            return response()->json([
                'message' => 'Status invalido.',
                'errors' => ['status' => ['Status invalido.']],
            ], 422);
        }

        $result = $this->orders->updateStatus((int) $orderId, $data['status']);

        if (($result['error'] ?? null) === 'not_found') {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        if (($result['error'] ?? null) === 'invalid_transition') {
            return response()->json([
                'message' => 'Transicao de status invalida.',
                'current_status' => $result['order']['status'] ?? null,
            ], 409);
        }

        return response()->json($result['order']);
    }

    public function sendToKitchen(string $orderId): JsonResponse
    {
        $result = $this->orders->updateStatus((int) $orderId, 'enviado_cozinha');

        if (($result['error'] ?? null) === 'not_found') {
            return response()->json(['message' => 'Pedido nao encontrado.'], 404);
        }

        if (($result['error'] ?? null) === 'invalid_transition') {
            return response()->json([
                'message' => 'Pedido nao pode ser enviado para a cozinha.',
                'current_status' => $result['order']['status'] ?? null,
            ], 409);
        }

        return response()->json($result['order']);
    }
}
