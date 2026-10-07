<?php

namespace App\Services;

use App\Models\Entrega;
use App\Models\Entregador;
use App\Models\RotaEntrega;
use App\Models\RotaEntregaItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RotaInteligenteService
{
    /** Raio, em km, usado pra considerar dois pedidos "no mesmo trajeto". */
    private const RAIO_KM_PADRAO = 1.5;

    /**
     * Ponto de entrada chamado quando o motoboy bipa o QR Code de um pedido de delivery.
     * Retorna a RotaEntrega (nova ou existente) já com os itens ordenados.
     */
    public function atribuirOuAgrupar(Entrega $entrega, Entregador $entregador, float $raioKm = self::RAIO_KM_PADRAO): RotaEntrega
    {
        // 1) Esse pedido já pertence a uma rota (outro item do grupo já foi bipado antes)?
        $itemExistente = $entrega->rotaEntregaItem()->with('rota.itens.entrega.pedido')->first();
        if ($itemExistente) {
            return $itemExistente->rota;
        }

        return DB::transaction(function () use ($entrega, $entregador, $raioKm) {
            // 2) Etapa 1 - filtro grosso por raio (Haversine), só entregas sem rota ainda.
            $candidatas = $this->buscarCandidatasNoRaio($entrega, $raioKm);

            // 3) Cria a rota e associa o pedido bipado + os candidatos encontrados.
            $rota = RotaEntrega::create([
                'id_entregador' => $entregador->id_entregador,
                'status' => 'MONTANDO',
            ]);

            $entregasDaRota = $candidatas->push($entrega)->unique('id_entrega')->values();

            foreach ($entregasDaRota as $e) {
                $e->update(['id_entregador' => $entregador->id_entregador]);
            }

            // 4) Etapa 2 - ordena a sequência ideal (Google Directions, com fallback local).
            $ordem = $this->otimizarOrdem($entregasDaRota);

            foreach ($ordem as $posicao => $idEntrega) {
                RotaEntregaItem::create([
                    'id_rota_entrega' => $rota->id_rota_entrega,
                    'id_entrega' => $idEntrega,
                    'ordem_sequencia' => $posicao + 1,
                ]);
            }

            $rota->update([
                'status' => 'EM_ANDAMENTO',
                'ordem_otimizada_json' => $ordem,
            ]);

            return $rota->fresh('itens.entrega.pedido');
        });
    }

    /**
     * Etapa 1: filtro geográfico grosso via fórmula de Haversine direto no banco.
     * Considera apenas entregas de delivery ainda sem entregador/rota atribuídos.
     */
    private function buscarCandidatasNoRaio(Entrega $entregaBase, float $raioKm)
    {
        if (is_null($entregaBase->latitude_destino) || is_null($entregaBase->longitude_destino)) {
            return collect();
        }

        $lat = (float) $entregaBase->latitude_destino;
        $lng = (float) $entregaBase->longitude_destino;

        // Haversine: distância em km entre o ponto base e cada entrega candidata.
        $formulaDistancia = '
            (6371 * acos(
                cos(radians(?)) * cos(radians(latitude_destino)) *
                cos(radians(longitude_destino) - radians(?)) +
                sin(radians(?)) * sin(radians(latitude_destino))
            ))
        ';

        return Entrega::query()
            ->select('entrega.*')
            ->selectRaw("$formulaDistancia as distancia_calculada", [$lat, $lng, $lat])
            ->whereNull('id_entregador')
            ->where('status_entrega', 'AGUARDANDO')
            ->where('id_entrega', '!=', $entregaBase->id_entrega)
            ->whereNotNull('latitude_destino')
            ->whereNotNull('longitude_destino')
            ->having('distancia_calculada', '<=', $raioKm)
            ->orderBy('distancia_calculada')
            ->get();
    }

    /**
     * Etapa 2: ordena a sequência de visita. Tenta Google Directions (waypoints otimizados);
     * se a API falhar ou a chave não estiver configurada, cai pro fallback local (nearest neighbor).
     *
     * @return array<int> lista de id_entrega na ordem de visita
     */
    private function otimizarOrdem($entregas): array
    {
        if ($entregas->count() <= 1) {
            return $entregas->pluck('id_entrega')->all();
        }

        $apiKey = config('services.google_maps.key');

        if ($apiKey) {
            try {
                return $this->otimizarComGoogleDirections($entregas, $apiKey);
            } catch (\Throwable $e) {
                Log::warning('Falha ao chamar Google Directions, usando fallback local.', [
                    'erro' => $e->getMessage(),
                ]);
            }
        }

        return $this->otimizarNearestNeighbor($entregas);
    }

    private function otimizarComGoogleDirections($entregas, string $apiKey): array
    {
        $origem = config('services.empresa.lat') . ',' . config('services.empresa.lng');

        $waypoints = $entregas->map(fn ($e) => "{$e->latitude_destino},{$e->longitude_destino}")->implode('|');

        $response = Http::get('https://maps.googleapis.com/maps/api/directions/json', [
            'origin' => $origem,
            'destination' => $origem, // volta pra loja; ajuste se o último ponto for o destino final
            'waypoints' => 'optimize:true|' . $waypoints,
            'key' => $apiKey,
        ]);

        $data = $response->throw()->json();

        $ordemIndices = $data['routes'][0]['waypoint_order'] ?? null;

        if (!$ordemIndices) {
            throw new \RuntimeException('Google Directions não retornou waypoint_order.');
        }

        $entregasArray = $entregas->values()->all();

        return collect($ordemIndices)
            ->map(fn ($i) => $entregasArray[$i]->id_entrega)
            ->all();
    }

    /**
     * Fallback gratuito: algoritmo guloso (vizinho mais próximo) usando Haversine local.
     * Menos preciso que rota real (ignora sentido de rua/trânsito), mas não depende de API paga.
     */
    private function otimizarNearestNeighbor($entregas): array
    {
        $restantes = $entregas->values()->all();
        $ordem = [];

        // Começa pela entrega mais próxima da loja (ou simplesmente a primeira da lista).
        $atual = array_shift($restantes);
        $ordem[] = $atual->id_entrega;

        while (!empty($restantes)) {
            usort($restantes, fn ($a, $b) =>
                $this->distanciaHaversine($atual, $a) <=> $this->distanciaHaversine($atual, $b)
            );

            $atual = array_shift($restantes);
            $ordem[] = $atual->id_entrega;
        }

        return $ordem;
    }

    private function distanciaHaversine(Entrega $a, Entrega $b): float
    {
        $raioTerraKm = 6371;

        $lat1 = deg2rad((float) $a->latitude_destino);
        $lat2 = deg2rad((float) $b->latitude_destino);
        $deltaLat = $lat2 - $lat1;
        $deltaLng = deg2rad((float) $b->longitude_destino - (float) $a->longitude_destino);

        $h = sin($deltaLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($deltaLng / 2) ** 2;

        return $raioTerraKm * 2 * atan2(sqrt($h), sqrt(1 - $h));
    }
}
