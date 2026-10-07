<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FechamentoCaixaEntregador extends Model
{
    protected $table = 'fechamento_caixa_entregador';
    protected $primaryKey = 'id_fechamento';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_entregador',
        'dt_referencia',
        'qtd_entregas',
        'vl_total_taxas',
        'vl_dinheiro_recebido',
        'status_pagamento',
        'dt_fechamento',
    ];

    protected function casts(): array
    {
        return [
            'dt_referencia' => 'date',
            'dt_fechamento' => 'datetime',
            'vl_total_taxas' => 'decimal:2',
            'vl_dinheiro_recebido' => 'decimal:2',
        ];
    }

    public function entregador()
    {
        return $this->belongsTo(Entregador::class, 'id_entregador', 'id_entregador');
    }
}
