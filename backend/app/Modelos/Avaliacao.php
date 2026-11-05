<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Avaliacao extends Model
{
    protected $table = 'avaliacao';
    protected $primaryKey = 'id_avaliacao';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_pedido',
        'id_cliente',
        'id_entregador',
        'nota',
        'ds_comentario',
    ];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'id_pedido', 'id_pedido');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'id_cliente', 'id_cliente');
    }

    public function entregador()
    {
        return $this->belongsTo(Entregador::class, 'id_entregador', 'id_entregador');
    }
}
