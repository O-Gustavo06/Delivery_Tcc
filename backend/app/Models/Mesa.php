<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Empresa;
use App\Models\Pedido;

class Mesa extends Model
{
    protected $table = 'mesa';
    protected $primaryKey = 'id_mesa';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_empresa',
        'nr_mesa',
        'status_ocupacao',
        'qr_code_token',
        'capacidade',
    ];

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'id_mesa', 'id_mesa');
    }

    public function comandas()
    {
        return $this->hasMany(Comanda::class, 'id_mesa', 'id_mesa');
    }

    public function comandaAberta()
    {
        return $this->hasOne(Comanda::class, 'id_mesa', 'id_mesa')
            ->whereIn('status', ['ABERTA', 'AGUARDANDO_PAGAMENTO'])
            ->latestOfMany('id_comanda');
    }
}
