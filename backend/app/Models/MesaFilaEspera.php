<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MesaFilaEspera extends Model
{
    protected $table = 'mesa_fila_espera';
    protected $primaryKey = 'id_fila_espera';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_empresa',
        'nm_cliente',
        'nr_pessoas',
    ];

    protected function casts(): array
    {
        return [
            'dt_cadastro' => 'datetime',
        ];
    }
}
