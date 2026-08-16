<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProdutoIngrediente extends Model
{
    protected $table = 'produto_ingrediente';
    protected $primaryKey = 'id_produto_ingrediente';

    public $timestamps = false;

    protected $fillable = [
        'id_produto',
        'id_ingrediente',
        'qtde',
        'unidade',
    ];

    public function produto()
    {
        return $this->belongsTo(Produto::class, 'id_produto', 'id_produto');
    }

    public function ingrediente()
    {
        return $this->belongsTo(Ingrediente::class, 'id_ingrediente', 'id_ingrediente');
    }
}
