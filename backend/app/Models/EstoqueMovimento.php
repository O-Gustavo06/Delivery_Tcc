<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EstoqueMovimento extends Model
{
    protected $table = 'estoque_movimento';
    protected $primaryKey = 'id_movimento';

    const CREATED_AT = 'dt_movimento';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_ingrediente',
        'tipo',
        'qtde',
        'custo_unitario',
        'ds_motivo',
    ];

    protected function casts(): array
    {
        return [
            'qtde' => 'decimal:3',
            'custo_unitario' => 'decimal:2',
        ];
    }

    public function ingrediente()
    {
        return $this->belongsTo(Ingrediente::class, 'id_ingrediente', 'id_ingrediente');
    }
}
