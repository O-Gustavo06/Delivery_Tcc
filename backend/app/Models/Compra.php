<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Compra extends Model
{
    protected $table = 'compra';
    protected $primaryKey = 'id_compra';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_empresa',
        'id_usuario',
        'ds_descricao',
        'nm_fornecedor',
        'vl_total',
        'dt_compra',
    ];

    protected function casts(): array
    {
        return [
            'vl_total' => 'decimal:2',
            'dt_compra' => 'datetime',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'id_usuario', 'id_usuario');
    }

    public function itens()
    {
        return $this->hasMany(CompraItem::class, 'id_compra', 'id_compra');
    }
}
