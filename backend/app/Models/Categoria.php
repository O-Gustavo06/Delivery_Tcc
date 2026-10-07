<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Empresa;
use App\Models\Produto;

class Categoria extends Model
{
    protected $table = 'categoria';
    protected $primaryKey = 'id_categoria';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_empresa',
        'nm_categoria',
        'ds_categoria',
        'fl_ativa',
        'nr_ordem',
    ];

    protected function casts(): array
    {
        return [
            'fl_ativa' => 'boolean',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function produtos()
    {
        return $this->hasMany(Produto::class, 'id_categoria', 'id_categoria');
    }
}
