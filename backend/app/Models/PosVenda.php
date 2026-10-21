<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PosVenda extends Model
{
    protected $table = 'pos_venda';
    protected $primaryKey = 'id_pos_venda';

    protected $fillable = [
        'id_pedido',
        'id_comanda',
        'id_cliente',
        'telefone',
        'status',
        'nota',
        'ds_comentario',
        'dt_envio_previsto',
        'dt_enviado',
        'dt_resposta',
    ];

    protected function casts(): array
    {
        return [
            'nota' => 'integer',
            'dt_envio_previsto' => 'datetime',
            'dt_enviado' => 'datetime',
            'dt_resposta' => 'datetime',
        ];
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'id_pedido', 'id_pedido');
    }

    public function comanda()
    {
        return $this->belongsTo(Comanda::class, 'id_comanda', 'id_comanda');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'id_cliente', 'id_cliente');
    }

    public function mensagens()
    {
        return $this->hasMany(WhatsappMensagem::class, 'id_pos_venda', 'id_pos_venda');
    }
}
