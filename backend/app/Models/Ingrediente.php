<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Empresa;
use App\Models\EstoqueMovimento;

class Ingrediente extends Model
{
    protected $table = 'ingrediente';
    protected $primaryKey = 'id_ingrediente';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_empresa',
        'nm_ingrediente',
        'unidade',
        'fl_ativo',
    ];

    protected function casts(): array
    {
        return [
            'fl_ativo' => 'boolean',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function movimentos()
    {
        return $this->hasMany(EstoqueMovimento::class, 'id_ingrediente', 'id_ingrediente');
    }
}
