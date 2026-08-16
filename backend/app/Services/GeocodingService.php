<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Converte um endereco em coordenadas (latitude/longitude), pra alimentar o agrupamento por
 * proximidade do RotaInteligenteService. Usa o Nominatim (OpenStreetMap) - gratuito, sem
 * chave. Se configurarem GOOGLE_MAPS_API_KEY, o RotaInteligenteService continua usando o
 * Google só pra otimizar a ORDEM da rota; a geocodificação em si segue pelo Nominatim.
 *
 * O Nominatim tem cobertura de CEP bem incompleta no Brasil (varios CEPs de cidades menores
 * simplesmente nao estao mapeados) - busca por rua+cidade acha muito mais, entao e tentada
 * primeiro. CEP sozinho fica como reforço, caso a rua nao seja encontrada.
 */
class GeocodingService
{
    /** Politica de uso do Nominatim: no maximo 1 requisicao por segundo. */
    private const INTERVALO_MINIMO_SEGUNDOS = 1.1;

    private const CACHE_KEY_ULTIMA_CHAMADA = 'geocoding:nominatim:ultima_chamada';

    public function coordenadasPorEndereco(?string $rua, ?string $cidade, ?string $uf, ?string $cep = null): ?array
    {
        if (!empty($rua) && !empty($cidade)) {
            $coordenadas = $this->buscar([
                'street' => $rua,
                'city' => $cidade,
                'state' => $uf,
                'country' => 'Brazil',
                'format' => 'json',
                'limit' => 1,
            ]);

            if ($coordenadas) {
                return $coordenadas;
            }
        }

        $cepLimpo = preg_replace('/\D/', '', (string) $cep);
        if (strlen($cepLimpo) === 8) {
            return $this->buscar([
                'postalcode' => $cepLimpo,
                'country' => 'Brazil',
                'format' => 'json',
                'limit' => 1,
            ]);
        }

        return null;
    }

    /** Mantido pra compatibilidade - so pelo CEP, sem rua/cidade. */
    public function coordenadasPorCep(string $cep): ?array
    {
        return $this->coordenadasPorEndereco(null, null, null, $cep);
    }

    private function buscar(array $params): ?array
    {
        // Duas tentativas: pedidos criados em sequencia rapida (comum num teste/demo) podem
        // esbarrar no limite de 1 req/s do Nominatim na primeira tentativa.
        $coordenadas = $this->tentarGeocodificar($params);
        if (!$coordenadas) {
            $coordenadas = $this->tentarGeocodificar($params);
        }

        return $coordenadas;
    }

    private function tentarGeocodificar(array $params): ?array
    {
        $this->respeitarLimiteDeTaxa();

        try {
            $response = Http::withHeaders([
                // Nominatim exige um User-Agent identificavel (politica de uso deles).
                'User-Agent' => 'RestauranteModeloTCC/1.0 (uso academico)',
            ])
                ->timeout(5)
                ->get('https://nominatim.openstreetmap.org/search', $params);

            if (!$response->ok()) {
                Log::warning('Nominatim respondeu com erro ao geocodificar.', [
                    'params' => $params,
                    'status' => $response->status(),
                ]);

                return null;
            }

            $resultados = $response->json();
            if (empty($resultados[0]['lat']) || empty($resultados[0]['lon'])) {
                Log::warning('Nominatim nao encontrou coordenadas.', ['params' => $params]);

                return null;
            }

            return [
                'lat' => (float) $resultados[0]['lat'],
                'lng' => (float) $resultados[0]['lon'],
            ];
        } catch (\Throwable $e) {
            // Geocodificacao e um "nice to have" - se falhar (rede, timeout, etc), o pedido
            // ainda deve ser criado normalmente, so sem entrar no agrupamento por proximidade.
            Log::warning('Falha ao geocodificar.', ['params' => $params, 'erro' => $e->getMessage()]);

            return null;
        }
    }

    /** Espera o tempo que faltar pra completar 1.1s desde a ultima chamada ao Nominatim. */
    private function respeitarLimiteDeTaxa(): void
    {
        $ultimaChamada = Cache::get(self::CACHE_KEY_ULTIMA_CHAMADA);

        if ($ultimaChamada) {
            $decorrido = microtime(true) - $ultimaChamada;
            $faltando = self::INTERVALO_MINIMO_SEGUNDOS - $decorrido;
            if ($faltando > 0) {
                usleep((int) ($faltando * 1_000_000));
            }
        }

        Cache::put(self::CACHE_KEY_ULTIMA_CHAMADA, microtime(true), 10);
    }
}
