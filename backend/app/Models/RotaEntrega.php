<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RotaEntrega extends Model
{
    protected $table = 'rota_entrega';
    protected $primaryKey = 'id_rota_entrega';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_entregador',
        'status',
        'ordem_otimizada_json',
    ];

    protected function casts(): array
    {
        return [
            'ordem_otimizada_json' => 'array',
        ];
    }

    public function entregador()
    {
        return $this->belongsTo(Entregador::class, 'id_entregador', 'id_entregador');
    }

    public function itens()
    {
        return $this->hasMany(RotaEntregaItem::class, 'id_rota_entrega', 'id_rota_entrega')
            ->orderBy('ordem_sequencia');
    }
}
