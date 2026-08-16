<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comanda extends Model
{
    protected $table = 'comanda';
    protected $primaryKey = 'id_comanda';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_mesa',
        'status',
        'forma_pagamento',
        'id_usuario_confirmou',
        'dt_fechamento',
    ];

    protected function casts(): array
    {
        return [
            'dt_fechamento' => 'datetime',
        ];
    }

    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'id_mesa', 'id_mesa');
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'id_comanda', 'id_comanda');
    }

    public function usuarioConfirmou()
    {
        return $this->belongsTo(User::class, 'id_usuario_confirmou', 'id_usuario');
    }

    public function getTotalAttribute(): float
    {
        return (float) $this->pedidos->sum('vl_total');
    }
}
