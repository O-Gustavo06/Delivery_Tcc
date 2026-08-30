<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Empresa;
use App\Models\Cliente;
use App\Models\Mesa;
use App\Models\ItemPedido;
use App\Models\Pagamento;
use App\Models\Entrega;
use App\Models\Avaliacao;

class Pedido extends Model
{
    protected $table = 'pedido';
    protected $primaryKey = 'id_pedido';

    const CREATED_AT = 'dt_pedido';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_empresa',
        'id_cliente',
        'id_mesa',
        'id_comanda',
        'codigo_qr',
        'tipo_pedido',
        'nr_pedido_delivery',
        'canal_origem',
        'status',
        'motivo_cancelamento',
        'vl_total',
        'vl_taxa_entrega',
        'ds_observacao',
        'ds_nota_pedido',
        'dt_conclusao',
    ];

    protected function casts(): array
    {
        return [
            'vl_total' => 'decimal:2',
            'vl_taxa_entrega' => 'decimal:2',
            'dt_conclusao' => 'datetime',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'id_cliente', 'id_cliente');
    }

    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'id_mesa', 'id_mesa');
    }

    public function comanda()
    {
        return $this->belongsTo(Comanda::class, 'id_comanda', 'id_comanda');
    }

    public function itens()
    {
        return $this->hasMany(ItemPedido::class, 'id_pedido', 'id_pedido');
    }

    public function pagamento()
    {
        return $this->hasOne(Pagamento::class, 'id_pedido', 'id_pedido');
    }

    public function entrega()
    {
        return $this->hasOne(Entrega::class, 'id_pedido', 'id_pedido');
    }

    public function avaliacao()
    {
        return $this->hasOne(Avaliacao::class, 'id_pedido', 'id_pedido');
    }
}
