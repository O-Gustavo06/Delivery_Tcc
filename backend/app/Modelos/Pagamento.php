<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Pedido;
use App\Models\TransacaoPagamento;

class Pagamento extends Model
{
    protected $table = 'pagamento';
    protected $primaryKey = 'id_pagamento';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_pedido',
        'forma',
        'troco_para',
        'status',
        'vl_total',
        'vl_desconto',
        'vl_final',
    ];

    protected function casts(): array
    {
        return [
            'vl_total' => 'decimal:2',
            'vl_desconto' => 'decimal:2',
            'vl_final' => 'decimal:2',
            'troco_para' => 'decimal:2',
        ];
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'id_pedido', 'id_pedido');
    }

    public function transacoes()
    {
        return $this->hasMany(TransacaoPagamento::class, 'id_pagamento', 'id_pagamento');
    }

    /**
     * Troco que o motoboy precisa levar da caixa da loja.
     * Ex: troco_para = 100, vl_final = 65 -> retorna 35.
     */
    public function getTrocoCalculadoAttribute(): ?float
    {
        if ($this->forma !== 'DINHEIRO' || is_null($this->troco_para)) {
            return null;
        }

        return round((float) $this->troco_para - (float) $this->vl_final, 2);
    }
}
