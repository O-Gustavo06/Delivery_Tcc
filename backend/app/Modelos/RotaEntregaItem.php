<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RotaEntregaItem extends Model
{
    protected $table = 'rota_entrega_item';
    protected $primaryKey = 'id_rota_entrega_item';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_rota_entrega',
        'id_entrega',
        'ordem_sequencia',
        'dt_entregue',
    ];

    protected function casts(): array
    {
        return [
            'dt_entregue' => 'datetime',
        ];
    }

    public function rota()
    {
        return $this->belongsTo(RotaEntrega::class, 'id_rota_entrega', 'id_rota_entrega');
    }

    public function entrega()
    {
        return $this->belongsTo(Entrega::class, 'id_entrega', 'id_entrega');
    }
}
