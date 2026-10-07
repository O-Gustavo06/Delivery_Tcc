<?php

namespace App\Services;

use App\Models\Empresa;

/**
 * Calcula a taxa de entrega com base em `empresa.config_taxas_km` (faixas por distancia).
 * Formato esperado: {"taxa_padrao": 8, "faixas": [{"ate_km": 3, "valor": 5}, ...]}, faixas
 * ordenadas por ate_km - distancia alem da ultima faixa usa o valor da ultima faixa (sem
 * cobranca extra por km). Se a empresa nao configurou faixas, se as coordenadas da empresa
 * (EMPRESA_LAT/EMPRESA_LNG) nao estao no .env, ou se o destino nao foi geocodificado, cai no
 * taxa_padrao (ou R$8 se nem isso foi configurado) - mesmo comportamento fixo de antes.
 */
class TaxaEntregaService
{
    private const TAXA_PADRAO_FALLBACK = 8.0;

    public function calcular(?float $latDestino, ?float $lngDestino): float
    {
        $empresa = Empresa::orderBy('id_empresa')->first();
        $config = $empresa?->config_taxas_km;

        $taxaPadrao = isset($config['taxa_padrao']) ? (float) $config['taxa_padrao'] : self::TAXA_PADRAO_FALLBACK;
        $faixas = $config['faixas'] ?? [];

        $latEmpresa = config('services.empresa.lat');
        $lngEmpresa = config('services.empresa.lng');

        if (empty($faixas) || !$latEmpresa || !$lngEmpresa || !$latDestino || !$lngDestino) {
            return $taxaPadrao;
        }

        usort($faixas, fn (array $a, array $b) => $a['ate_km'] <=> $b['ate_km']);

        $distanciaKm = $this->distanciaHaversine((float) $latEmpresa, (float) $lngEmpresa, $latDestino, $lngDestino);

        foreach ($faixas as $faixa) {
            if ($distanciaKm <= (float) $faixa['ate_km']) {
                return (float) $faixa['valor'];
            }
        }

        return (float) end($faixas)['valor'];
    }

    private function distanciaHaversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $raioTerraKm = 6371;

        $lat1Rad = deg2rad($lat1);
        $lat2Rad = deg2rad($lat2);
        $deltaLat = deg2rad($lat2 - $lat1);
        $deltaLng = deg2rad($lng2 - $lng1);

        $h = sin($deltaLat / 2) ** 2 + cos($lat1Rad) * cos($lat2Rad) * sin($deltaLng / 2) ** 2;

        return $raioTerraKm * 2 * atan2(sqrt($h), sqrt(1 - $h));
    }
}
