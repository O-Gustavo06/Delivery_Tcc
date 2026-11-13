<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentoFiscal extends Model
{
    protected $table = 'documento_fiscal';
    protected $primaryKey = 'id_documento_fiscal';
    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_empresa', 'id_pedido', 'id_compra', 'modelo', 'direcao', 'status',
        'contexto_fiscal', 'itens',
    ];

    protected $hidden = ['caminho_xml', 'caminho_danfe'];

    protected function casts(): array
    {
        return ['contexto_fiscal' => 'array', 'itens' => 'array', 'tributos' => 'array'];
    }
}
