<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransacaoPagamento extends Model
{
    protected $table = 'transacao_pagamento';
    protected $primaryKey = 'id_transacao';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_pagamento',
        'provedor',
        'nsu',
        'autorizacao',
        'bandeira',
        'parcelas',
        'status',
        'payload_json',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
        ];
    }

    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class, 'id_pagamento', 'id_pagamento');
    }
}
