<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsappMensagem extends Model
{
    protected $table = 'whatsapp_mensagem';
    protected $primaryKey = 'id_whatsapp_mensagem';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'id_whatsapp_instancia',
        'id_cliente',
        'direcao',
        'telefone',
        'conteudo',
        'tipo',
        'id_externo',
        'status_envio',
        'dt_mensagem',
    ];

    protected function casts(): array
    {
        return [
            'dt_mensagem' => 'datetime',
        ];
    }

    public function instancia()
    {
        return $this->belongsTo(WhatsappInstance::class, 'id_whatsapp_instancia', 'id_whatsapp_instancia');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'id_cliente', 'id_cliente');
    }
}
