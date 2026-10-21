<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\Promocao;
use App\Models\Produto;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PromocaoService
{
    public function campanhasPublicas(int $empresaId): array
    {
        return $this->campanhasAtivas($empresaId, 'produto')
            ->map(fn (Promocao $promocao) => [
                'id' => (int) $promocao->id_promocao,
                'nome' => $promocao->nome,
                'tipo_desconto' => $promocao->tipo_desconto,
                'valor_desconto' => (float) $promocao->valor_desconto,
                'dt_fim' => $promocao->dt_fim?->toIso8601String(),
                'produtos' => $promocao->produtos->pluck('id_produto')->map(fn ($id) => (int) $id)->all(),
                'categorias' => $promocao->categorias->pluck('id_categoria')->map(fn ($id) => (int) $id)->all(),
            ])->values()->all();
    }

    public function calcular(
        int $empresaId,
        array $items,
        Collection $products,
        ?string $couponCode = null,
        ?int $clientId = null,
        bool $lockForUpdate = false,
    ): array {
        $originalSubtotal = 0.0;
        $lines = [];
        foreach ($items as $item) {
            $product = $products->get($item['id_produto']);
            if (!$product) {
                continue;
            }

            $quantity = (int) $item['qty'];
            $unitPrice = (float) $product->vl_preco_base;
            $productId = (int) $product->id_produto;
            $lineSubtotal = round($unitPrice * $quantity, 2);
            $originalSubtotal += $lineSubtotal;
            $lines[] = [
                'product_id' => $productId,
                'product' => $product,
                'qty' => $quantity,
                'unit_price' => $unitPrice,
                'subtotal' => $lineSubtotal,
            ];
        }
        $originalSubtotal = round($originalSubtotal, 2);

        $campaigns = $this->activeCampaignQuery($empresaId, 'produto', $lockForUpdate)->get();
        $directDiscounts = [];
        foreach ($campaigns as $campaign) {
            $eligibleProducts = $this->eligibleProductIds($campaign);
            foreach ($lines as &$line) {
                if (!isset($eligibleProducts[$line['product_id']])) {
                    continue;
                }
                $saving = $this->discountForAmount($campaign, $line['unit_price']);
                if ($saving <= 0) {
                    continue;
                }
                if ($saving > ($line['best_saving'] ?? 0)) {
                    $line['best_saving'] = $saving;
                    $line['best_campaign'] = $campaign;
                }
            }
            unset($line);
        }

        foreach ($lines as &$line) {
            if (!isset($line['best_campaign'])) {
                continue;
            }
            $campaign = $line['best_campaign'];
            $saving = round($line['best_saving'] * $line['qty'], 2);
            $line['unit_price'] = round($line['unit_price'] - $line['best_saving'], 2);
            $line['subtotal'] = round($line['unit_price'] * $line['qty'], 2);
            $directDiscounts[$campaign->id_promocao] = ($directDiscounts[$campaign->id_promocao] ?? 0) + $saving;
        }
        unset($line);

        $automaticSubtotal = round(array_sum(array_column($lines, 'subtotal')), 2);
        $couponDiscount = 0.0;
        $coupon = null;
        if ($couponCode !== null && trim($couponCode) !== '') {
            $coupon = $this->couponQuery($empresaId, $couponCode, $lockForUpdate)->first();
            if (!$coupon || !$this->isCurrentlyActive($coupon)) {
                throw ValidationException::withMessages([
                    'coupon_code' => ['Este cupom não existe ou não está ativo neste momento.'],
                ]);
            }
            $eligibleIds = $this->eligibleProductIds($coupon);
            $eligibleSubtotal = 0.0;
            foreach ($lines as $line) {
                if (isset($eligibleIds[$line['product_id']])) {
                    $eligibleSubtotal += $line['subtotal'];
                }
            }
            $eligibleSubtotal = round($eligibleSubtotal, 2);
            if ($eligibleSubtotal <= 0) {
                throw ValidationException::withMessages([
                    'coupon_code' => ['Nenhum produto deste pedido participa do cupom.'],
                ]);
            }

            $couponDiscount = min($eligibleSubtotal, $this->discountForAmount($coupon, $eligibleSubtotal));
            $this->allocateDiscount($lines, $eligibleIds, $couponDiscount);
        }

        $discountTotal = round($originalSubtotal - array_sum(array_column($lines, 'subtotal')), 2);
        $discountByCampaign = [];
        foreach ($directDiscounts as $campaignId => $amount) {
            $discountByCampaign[$campaignId] = round($amount, 2);
        }
        if ($coupon && $couponDiscount > 0) {
            $discountByCampaign[$coupon->id_promocao] = round($couponDiscount, 2);
        }

        $orderItemsByLine = [];
        $orderItems = [];
        foreach ($lines as $line) {
            $lineItems = $line['order_items'] ?? [[
                'qty' => $line['qty'],
                'unit_price' => $line['unit_price'],
                'subtotal' => $line['subtotal'],
            ]];
            $orderItemsByLine[] = $lineItems;
            foreach ($lineItems as $orderItem) {
                $orderItems[] = [
                    'id_produto' => $line['product_id'],
                    ...$orderItem,
                ];
            }
        }

        return [
            'items' => array_map(fn (array $line) => [
                'id_produto' => $line['product_id'],
                'qty' => $line['qty'],
                'unit_price' => round($line['unit_price'], 2),
                'subtotal' => round($line['subtotal'], 2),
            ], array_values($lines)),
            'order_items_by_line' => $orderItemsByLine,
            'order_items' => $orderItems,
            'original_subtotal' => $originalSubtotal,
            'subtotal' => round(array_sum(array_column($lines, 'subtotal')), 2),
            'discount' => $discountTotal,
            'automatic_discount' => round($originalSubtotal - $automaticSubtotal, 2),
            'coupon_discount' => round($couponDiscount, 2),
            'coupon' => $coupon,
            'discounts_by_campaign' => $discountByCampaign,
        ];
    }

    public function registrarUtilizacoes(array $calculation, Pedido $pedido, int $clientId): void
    {
        foreach ($calculation['discounts_by_campaign'] as $campaignId => $amount) {
            if ($amount <= 0) {
                continue;
            }
            DB::table('promocao_utilizacao')->insert([
                'id_promocao' => $campaignId,
                'id_pedido' => $pedido->id_pedido,
                'id_cliente' => $clientId,
                'vl_desconto' => $amount,
                'cd_aplicado' => (int) $calculation['coupon']?->id_promocao === (int) $campaignId
                    ? $calculation['coupon']->codigo
                    : null,
                'dt_utilizacao' => now(),
            ]);
        }
    }

    private function campanhasAtivas(int $empresaId, string $tipo): Collection
    {
        return $this->activeCampaignQuery($empresaId, $tipo)->with(['produtos', 'categorias'])->get();
    }

    private function activeCampaignQuery(int $empresaId, string $tipo, bool $lockForUpdate = false): Builder
    {
        $query = Promocao::query()
            ->where('id_empresa', $empresaId)
            ->where('tipo', $tipo)
            ->where('fl_ativa', true)
            ->where(fn (Builder $query) => $query->whereNull('dt_fim')->orWhere('dt_fim', '>=', now()))
            ->orderBy('id_promocao');

        return $lockForUpdate ? $query->lockForUpdate() : $query;
    }

    private function couponQuery(int $empresaId, string $code, bool $lockForUpdate = false): Builder
    {
        $query = Promocao::query()
            ->where('id_empresa', $empresaId)
            ->where('tipo', 'cupom')
            ->whereRaw('UPPER(codigo) = ?', [mb_strtoupper(trim($code))]);

        return $lockForUpdate ? $query->lockForUpdate() : $query;
    }

    private function isCurrentlyActive(Promocao $campaign): bool
    {
        return (bool) $campaign->fl_ativa
            && (!$campaign->dt_fim || $campaign->dt_fim->greaterThanOrEqualTo(now()));
    }

    private function eligibleProductIds(Promocao $campaign): array
    {
        $productIds = $campaign->produtos->pluck('id_produto')->map(fn ($id) => (int) $id)->all();
        $categoryIds = $campaign->categorias->pluck('id_categoria')->map(fn ($id) => (int) $id)->all();
        if ($categoryIds) {
            $categoryProducts = Produto::whereIn('id_categoria', $categoryIds)
                ->where('id_empresa', $campaign->id_empresa)
                ->pluck('id_produto')
                ->map(fn ($id) => (int) $id)
                ->all();
            $productIds = array_merge($productIds, $categoryProducts);
        }

        return array_fill_keys($productIds, true);
    }

    private function discountForAmount(Promocao $campaign, float $amount): float
    {
        $discount = $campaign->tipo_desconto === 'percentual'
            ? $amount * ((float) $campaign->valor_desconto / 100)
            : (float) $campaign->valor_desconto;

        return round(min($amount, $discount), 2);
    }

    private function allocateDiscount(array &$lines, array $eligibleIds, float $discount): void
    {
        $eligible = [];
        foreach ($lines as $lineKey => $line) {
            if (isset($eligibleIds[$line['product_id']]) && $line['subtotal'] > 0) {
                $eligible[$lineKey] = (int) round($line['subtotal'] * 100);
            }
        }

        $remaining = (int) round($discount * 100);
        $discountCents = $remaining;
        $total = array_sum($eligible);
        $lastId = array_key_last($eligible);
        $shares = [];
        foreach ($eligible as $lineKey => $amount) {
            $share = $lineKey === $lastId
                ? $remaining
                : min($remaining, (int) round($discountCents * ($amount / $total)));
            $share = min($share, $amount);
            $shares[$lineKey] = $share;
            $remaining -= $share;
        }

        foreach ($eligible as $lineKey => $amount) {
            if ($remaining <= 0) break;
            $extra = min($remaining, $amount - $shares[$lineKey]);
            $shares[$lineKey] += $extra;
            $remaining -= $extra;
        }

        foreach ($shares as $lineKey => $share) {
            $quantity = $lines[$lineKey]['qty'];
            $unitPriceCents = (int) round($lines[$lineKey]['unit_price'] * 100);
            $discountPerUnit = intdiv($share, $quantity);
            $discountExtraUnits = $share % $quantity;
            $regularUnits = $quantity - $discountExtraUnits;
            $lines[$lineKey]['order_items'] = [];

            if ($regularUnits > 0) {
                $regularUnitPrice = ($unitPriceCents - $discountPerUnit) / 100;
                $lines[$lineKey]['order_items'][] = [
                    'qty' => $regularUnits,
                    'unit_price' => round($regularUnitPrice, 2),
                    'subtotal' => round($regularUnitPrice * $regularUnits, 2),
                ];
            }
            if ($discountExtraUnits > 0) {
                $extraUnitPrice = ($unitPriceCents - $discountPerUnit - 1) / 100;
                $lines[$lineKey]['order_items'][] = [
                    'qty' => $discountExtraUnits,
                    'unit_price' => round($extraUnitPrice, 2),
                    'subtotal' => round($extraUnitPrice * $discountExtraUnits, 2),
                ];
            }

            $lines[$lineKey]['subtotal'] = round(array_sum(array_column($lines[$lineKey]['order_items'], 'subtotal')), 2);
            $lines[$lineKey]['unit_price'] = round(
                $lines[$lineKey]['subtotal'] / $lines[$lineKey]['qty'],
                2,
            );
        }
    }
}
