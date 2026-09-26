<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google_maps' => [
        'key' => env('GOOGLE_MAPS_API_KEY')
    ],
    'empresa' => [
        'lat' => env('EMPRESA_LAT'), 'lng' => env('EMPRESA_LNG')
    ],
    'vapid' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:contato@chefshub.local'),
    ],

    'evolution' => [
        // URL base da Evolution API (camada de comunicacao com o WhatsApp). Dentro do
        // Docker, aponta pro servico "evolution-api" do docker-compose; fora do Docker,
        // pro container publicado em localhost:8080.
        'base_url' => env('EVOLUTION_API_URL', 'http://localhost:8080'),
        // Precisa bater com AUTHENTICATION_API_KEY configurado no container da Evolution API.
        'api_key' => env('EVOLUTION_API_KEY'),
        // URL que a Evolution API vai chamar quando um evento acontecer (mensagem recebida,
        // atualizacao de conexao etc). Por padrao deriva do APP_URL do proprio backend.
        'webhook_url' => env('EVOLUTION_WEBHOOK_URL'),
    ],

    'asaas' => [
        'base_url' => env('ASAAS_ENV', 'sandbox') === 'production'
            ? 'https://api.asaas.com/v3'
            : 'https://api-sandbox.asaas.com/v3',
        'api_key' => env('ASAAS_API_KEY'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
        'success_url' => env('ASAAS_SUCCESS_URL', env('APP_URL') . '/pagamento/sucesso'),
        'ca_bundle' => env('ASAAS_CA_BUNDLE'),
    ],

];
