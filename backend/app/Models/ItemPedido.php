<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemPedido extends Model
{
    protected $table = 'item_pedido';
    protected $primaryKey = 'id_item_pedido';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_pedido',
        'id_produto',
        'nr_quantidade',
        'vl_preco_unitario',
        'vl_subtotal',
        'adicionais_json',
    ];

    protected function casts(): array
    {
        return [
            'adicionais_json' => 'array',
            'vl_preco_unitario' => 'decimal:2',
            'vl_subtotal' => 'decimal:2',
        ];
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'id_pedido', 'id_pedido');
    }

    public function produto()
    {
        return $this->belongsTo(Produto::class, 'id_produto', 'id_produto');
    }
}
