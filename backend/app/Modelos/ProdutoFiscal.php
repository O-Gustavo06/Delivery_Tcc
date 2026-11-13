<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProdutoFiscal extends Model
{
    protected $table = 'produto_fiscal';
    protected $primaryKey = 'id_produto';
    public $incrementing = false;
    const CREATED_AT = null;
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'ncm', 'cest', 'cfop', 'cst_csosn', 'origem', 'aliquota_icms',
        'aliquota_pis', 'aliquota_cofins', 'aliquota_ipi', 'informacoes_adicionais',
    ];
}
