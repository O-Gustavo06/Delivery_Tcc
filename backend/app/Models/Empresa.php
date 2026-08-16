<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Categoria;
use App\Models\Produto;
use App\Models\Mesa;
use App\Models\Pedido;

class Empresa extends Model
{
    protected $table = 'empresa';
    protected $primaryKey = 'id_empresa';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'nm_empresa',
        'cnpj',
        'chave_pix',
        'config_taxas_km',
    ];

    protected function casts(): array
    {
        return [
            'config_taxas_km' => 'array',
        ];
    }

    public function categorias()
    {
        return $this->hasMany(Categoria::class, 'id_empresa', 'id_empresa');
    }

    public function produtos()
    {
        return $this->hasMany(Produto::class, 'id_empresa', 'id_empresa');
    }

    public function mesas()
    {
        return $this->hasMany(Mesa::class, 'id_empresa', 'id_empresa');
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'id_empresa', 'id_empresa');
    }
}
