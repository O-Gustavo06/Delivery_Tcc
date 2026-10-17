<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pagamento;
use App\Models\TransacaoPagamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class AsaasWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $expectedToken = (string) config('services.asaas.webhook_token');
        $receivedToken = (string) $request->header('asaas-access-token');

        if (!$expectedToken || !$receivedToken || !hash_equals($expectedToken, $receivedToken)) {
            return response()->json(['message' => 'Webhook nao autorizado.'], 401);
        }

        $paymentData = $request->input('payment');
        if (!is_array($paymentData)) {
            return response()->json(['message' => 'Dados do pagamento inválidos.'], 422);
        }

        $paymentId = $paymentData['id'] ?? null;
        if (!$paymentId) {
            return response()->json(['message' => 'Identificador do pagamento ausente.'], 422);
        }

        $status = $this->statusesForEvent((string) $request->input('event'));
        if ($status === null) {
            return response()->json(['received' => true]);
        }

        $transaction = TransacaoPagamento::where('provedor', 'ASAAS')
            ->where('nsu', $paymentId)
            ->first();
        $reference = $paymentData['externalReference'] ?? null;
        $orderId = $reference && preg_match('/^pedido:(\d+)$/', $reference, $matches) ? (int) $matches[1] : null;
        $payment = $transaction?->pagamento;

        if (!$payment && $orderId) {
            $payment = Pagamento::where('id_pedido', $orderId)->first();
        }

        if (!$payment) {
            Log::warning('Webhook Asaas recebido sem pagamento local correspondente.', [
                'payment_id' => $paymentId,
                'external_reference' => $reference,
            ]);

            return response()->json(['message' => 'Pagamento local ainda não encontrado.'], 503);
        }

        DB::transaction(function () use ($payment, $paymentId, $status, $paymentData) {
            $lockedPayment = Pagamento::whereKey($payment->id_pagamento)->lockForUpdate()->firstOrFail();
            $lockedTransaction = TransacaoPagamento::where('provedor', 'ASAAS')
                ->where('nsu', $paymentId)
                ->lockForUpdate()
                ->first();
            $shouldTransition = $this->canTransition($lockedPayment->status, $status['payment']);

            if ($shouldTransition) {
                $lockedPayment->update(['status' => $status['payment']]);
            }

            $payload = $lockedTransaction?->payload_json ?? [];
            $payload['payment'] = $paymentData;

            TransacaoPagamento::updateOrCreate(
                ['provedor' => 'ASAAS', 'nsu' => $paymentId],
                [
                    'id_pagamento' => $lockedPayment->id_pagamento,
                    'status' => $shouldTransition
                        ? $status['transaction']
                        : ($lockedTransaction?->status ?? $status['transaction']),
                    'payload_json' => $payload,
                ],
            );
        });

        return response()->json(['received' => true]);
    }

    private function statusesForEvent(string $event): ?array
    {
        return match ($event) {
            'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED' => [
                'payment' => 'APROVADO',
                'transaction' => 'APROVADA',
            ],
            'PAYMENT_OVERDUE', 'PAYMENT_DELETED' => [
                'payment' => 'CANCELADO',
                'transaction' => 'CANCELADA',
            ],
            'PAYMENT_REFUNDED' => [
                'payment' => 'ESTORNADO',
                'transaction' => 'ESTORNADA',
            ],
            'PAYMENT_REPROVED', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' => [
                'payment' => 'RECUSADO',
                'transaction' => 'RECUSADA',
            ],
            default => null,
        };
    }

    private function canTransition(string $currentStatus, string $nextStatus): bool
    {
        if ($currentStatus === 'ESTORNADO') {
            return false;
        }

        if ($currentStatus === 'APROVADO' && in_array($nextStatus, ['PENDENTE', 'CANCELADO', 'RECUSADO'], true)) {
            return false;
        }

        return !($currentStatus === 'CANCELADO' && $nextStatus === 'PENDENTE');
    }
}
