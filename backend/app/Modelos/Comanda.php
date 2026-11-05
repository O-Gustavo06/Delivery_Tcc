<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comanda extends Model
{
    protected $table = 'comanda';
    protected $primaryKey = 'id_comanda';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_mesa',
        'status',
        'forma_pagamento',
        'id_usuario_confirmou',
        'dt_fechamento',
    ];

    protected function casts(): array
    {
        return [
            'dt_fechamento' => 'datetime',
        ];
    }

    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'id_mesa', 'id_mesa');
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'id_comanda', 'id_comanda');
    }

    public function usuarioConfirmou()
    {
        return $this->belongsTo(User::class, 'id_usuario_confirmou', 'id_usuario');
    }

    /** Pedido cancelado continua na comanda (historico), mas nao entra na conta. */
    public function getTotalAttribute(): float
    {
        return round((float) $this->pedidos->where('status', '!=', 'CANCELADO')->sum('vl_total'), 2);
    }

    /**
     * Consumo da mesa agrupado por produto (mesmo prato pedido em rodadas diferentes vira uma
     * linha so) - e o "extrato" da conta mostrado pro cliente e pro caixa.
     * Precisa de pedidos.itens.produto carregados.
     */
    public function resumoConsumo(): array
    {
        return $this->pedidos
            ->where('status', '!=', 'CANCELADO')
            ->flatMap(fn (Pedido $pedido) => $pedido->itens)
            ->groupBy(fn ($item) => $item->id_produto . '|' . $item->vl_preco_unitario)
            ->map(function ($itens) {
                $primeiro = $itens->first();

                return [
                    'id_produto' => $primeiro->id_produto,
                    'nome' => $primeiro->produto?->nm_produto ?? 'Item',
                    'qty' => (int) $itens->sum('nr_quantidade'),
                    'preco' => (float) $primeiro->vl_preco_unitario,
                    'subtotal' => round((float) $itens->sum('vl_subtotal'), 2),
                ];
            })
            ->sortBy('nome')
            ->values()
            ->all();
    }
}
