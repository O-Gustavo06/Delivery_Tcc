<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pagamento;
use App\Models\TransacaoPagamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        $paymentData = $request->input('payment', []);
        $paymentId = $paymentData['id'] ?? null;
        if (!$paymentId) {
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
            return response()->json(['received' => true]);
        }

        $status = $this->localStatus((string) $request->input('event'));
        DB::transaction(function () use ($payment, $paymentId, $status, $paymentData, $transaction) {
            $payment->update(['status' => $status]);

            if ($transaction) {
                $transaction->update(['status' => $status, 'payload_json' => $paymentData]);
            } else {
                TransacaoPagamento::create([
                    'id_pagamento' => $payment->id_pagamento,
                    'provedor' => 'ASAAS',
                    'nsu' => $paymentId,
                    'status' => $status,
                    'payload_json' => $paymentData,
                ]);
            }
        });

        return response()->json(['received' => true]);
    }

    private function localStatus(string $event): string
    {
        if (in_array($event, ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'], true)) {
            return 'APROVADO';
        }

        if (in_array($event, ['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED'], true)) {
            return 'CANCELADO';
        }

        return 'PENDENTE';
    }
}
