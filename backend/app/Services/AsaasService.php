<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

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
            ->timeout(20);

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
        return $this->request()->get("/payments/{$paymentId}/pixQrCode")->throw()->json();
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
}
