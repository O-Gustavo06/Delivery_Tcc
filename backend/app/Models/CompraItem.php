<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompraItem extends Model
{
    protected $table = 'compra_item';
    protected $primaryKey = 'id_compra_item';

    public $timestamps = false;

    protected $fillable = [
        'id_compra',
        'id_ingrediente',
        'qtde',
        'vl_unitario',
        'vl_subtotal',
    ];

    protected function casts(): array
    {
        return [
            'qtde' => 'decimal:3',
            'vl_unitario' => 'decimal:2',
            'vl_subtotal' => 'decimal:2',
        ];
    }

    public function compra()
    {
        return $this->belongsTo(Compra::class, 'id_compra', 'id_compra');
    }

    public function ingrediente()
    {
        return $this->belongsTo(Ingrediente::class, 'id_ingrediente', 'id_ingrediente');
    }
}
