<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use LogicException;

class AsaasService
{
    public function enabled(): bool
    {
        return filled(config('services.asaas.api_key'));
    }

    private function request(): PendingRequest
    {
        $request = Http::baseUrl(config('services.asaas.base_url'))
            ->withHeaders([
                'access_token' => config('services.asaas.api_key'),
                'User-Agent' => 'RestauranteTcc/1.0',
            ])
            ->acceptJson()
            ->connectTimeout(3)
            ->timeout(8);

        $caBundle = config('services.asaas.ca_bundle');
        if ($caBundle) {
            $request = $request->withOptions(['verify' => $caBundle]);
        }

        return $request;
    }

    public function createCustomer(string $name, string $phone, string $cpfCnpj, ?string $email, ?string $address, ?string $addressNumber, ?string $postalCode, ?string $city, ?string $state, string $reference): array
    {
        $payload = [
            'name' => $name,
            'mobilePhone' => $phone,
            'cpfCnpj' => preg_replace('/\D/', '', $cpfCnpj),
            'externalReference' => $reference,
        ];

        if ($email) {
            $payload['email'] = $email;
        }

        if ($address) {
            $payload['address'] = $address;
            $payload['addressNumber'] = $addressNumber ?: 'S/N';
            $payload['postalCode'] = preg_replace('/\D/', '', (string) $postalCode);
            $payload['city'] = $city;
            $payload['state'] = $state;
        }

        return $this->request()->post('/customers', $payload)->throw()->json();
    }

    public function createPixPayment(string $customerId, float $value, string $reference, string $description): array
    {
        return $this->request()->post('/payments', [
            'customer' => $customerId,
            'billingType' => 'PIX',
            'value' => $value,
            'dueDate' => now()->toDateString(),
            'description' => $description,
            'externalReference' => $reference,
        ])->throw()->json();
    }

    public function getPixQrCode(string $paymentId): array
    {
        return $this->getWithRetry("/payments/{$paymentId}/pixQrCode");
    }

    public function findPaymentByExternalReference(string $reference): ?array
    {
        $response = $this->getWithRetry('/payments', [
            'externalReference' => $reference,
            'limit' => 10,
        ]);

        foreach ($response['data'] ?? [] as $payment) {
            if (($payment['externalReference'] ?? null) === $reference
                && !in_array($payment['status'] ?? null, ['OVERDUE', 'DELETED', 'REFUNDED'], true)) {
                return $payment;
            }
        }

        return null;
    }

    public function createCardCheckout(string $customerId, float $value, string $reference, string $description): array
    {
        return $this->request()->post('/checkouts', [
            'customer' => $customerId,
            'billingTypes' => ['CREDIT_CARD'],
            'chargeTypes' => ['DETACHED'],
            'externalReference' => $reference,
            'callback' => [
                'successUrl' => config('services.asaas.success_url'),
                'cancelUrl' => config('services.asaas.success_url'),
                'autoRedirect' => true,
            ],
            'items' => [[
                'name' => mb_substr($description, 0, 30),
                'description' => mb_substr($description, 0, 500),
                'quantity' => 1,
                'value' => $value,
            ]],
        ])->throw()->json();
    }

    private function getWithRetry(string $uri, array $query = []): array
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                $response = $this->request()->get($uri, $query)->throw()->json();
                return is_array($response) ? $response : [];
            } catch (ConnectionException $exception) {
                if ($attempt === 2) {
                    throw $exception;
                }
            } catch (RequestException $exception) {
                if (!$exception->response?->serverError() || $attempt === 2) {
                    throw $exception;
                }
            }

            usleep(200_000 * ($attempt + 1));
        }

        throw new LogicException('A consulta ao Asaas terminou sem resposta nem exceção.');
    }
}
