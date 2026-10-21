<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;
use App\Models\Pedido;
use App\Models\Avaliacao;

class Cliente extends Model
{
    protected $table = 'cliente';
    protected $primaryKey = 'id_cliente';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_usuario',
        'telefone',
        'telefone_normalizado',
        'id_cliente_principal',
        'cpf',
    ];

    protected static function booted(): void
    {
        static::saving(function (Cliente $cliente) {
            if ($cliente->id_cliente_principal) {
                $cliente->telefone_normalizado = null;
                return;
            }

            $cliente->telefone_normalizado = \App\Services\ClienteIdentityService::normalizarTelefone($cliente->telefone);
        });
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'id_usuario', 'id_usuario');
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'id_cliente', 'id_cliente');
    }

    public function avaliacoes()
    {
        return $this->hasMany(Avaliacao::class, 'id_cliente', 'id_cliente');
    }
}
