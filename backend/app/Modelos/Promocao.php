<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promocao extends Model
{
    protected $table = 'promocao';
    protected $primaryKey = 'id_promocao';

    protected $fillable = [
        'id_empresa',
        'tipo',
        'nome',
        'codigo',
        'tipo_desconto',
        'valor_desconto',
        'valor_minimo_pedido',
        'limite_utilizacoes',
        'limite_por_cliente',
        'dt_inicio',
        'dt_fim',
        'fl_ativa',
    ];

    protected function casts(): array
    {
        return [
            'valor_desconto' => 'decimal:2',
            'valor_minimo_pedido' => 'decimal:2',
            'limite_utilizacoes' => 'integer',
            'limite_por_cliente' => 'integer',
            'dt_inicio' => 'datetime',
            'dt_fim' => 'datetime',
            'fl_ativa' => 'boolean',
        ];
    }

    public function produtos()
    {
        return $this->belongsToMany(Produto::class, 'promocao_produto', 'id_promocao', 'id_produto');
    }

    public function categorias()
    {
        return $this->belongsToMany(Categoria::class, 'promocao_categoria', 'id_promocao', 'id_categoria');
    }
}
