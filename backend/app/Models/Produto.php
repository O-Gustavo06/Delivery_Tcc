<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Empresa;
use App\Models\Categoria;
use App\Models\ProdutoIngrediente;

class Produto extends Model
{
    protected $table = 'produto';
    protected $primaryKey = 'id_produto';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_empresa',
        'id_categoria',
        'nm_produto',
        'ds_produto',
        'vl_preco_base',
        'tempo_preparo_min',
        'fl_ativo',
        'url_imagem',
    ];

    protected function casts(): array
    {
        return [
            'fl_ativo' => 'boolean',
            'vl_preco_base' => 'decimal:2',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function categoria()
    {
        return $this->belongsTo(Categoria::class, 'id_categoria', 'id_categoria');
    }

    public function ingredientes()
    {
        return $this->hasMany(ProdutoIngrediente::class, 'id_produto', 'id_produto');
    }
}
