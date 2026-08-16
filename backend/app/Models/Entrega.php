<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Entrega extends Model
{
    protected $table = 'entrega';
    protected $primaryKey = 'id_entrega';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_pedido',
        'id_entregador',
        'status_entrega',
        'codigo_confirmacao_entrega',
        'latitude_coleta',
        'longitude_coleta',
        'latitude_destino',
        'longitude_destino',
        'horario_saida',
        'horario_chegada',
        'rota_json',
        'distancia_km',
        'tempo_estimado_min',
    ];

    protected function casts(): array
    {
        return [
            'rota_json' => 'array',
            'horario_saida' => 'datetime',
            'horario_chegada' => 'datetime',
        ];
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'id_pedido', 'id_pedido');
    }

    public function entregador()
    {
        return $this->belongsTo(Entregador::class, 'id_entregador', 'id_entregador');
    }

    public function rotaEntregaItem()
    {
        return $this->hasOne(RotaEntregaItem::class, 'id_entrega', 'id_entrega');
    }
}
