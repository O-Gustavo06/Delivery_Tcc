<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsappInstance extends Model
{
    protected $table = 'whatsapp_instancia';
    protected $primaryKey = 'id_whatsapp_instancia';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_empresa',
        'nm_instancia',
        'token_instancia',
        'status_conexao',
        'nr_telefone',
        'fl_webhook_configurado',
        'dt_conectado',
        'configuracoes',
    ];

    protected $hidden = [
        'token_instancia',
    ];

    protected function casts(): array
    {
        return [
            'fl_webhook_configurado' => 'boolean',
            'dt_conectado' => 'datetime',
            'configuracoes' => 'array',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'id_empresa', 'id_empresa');
    }

    public function mensagens()
    {
        return $this->hasMany(WhatsappMensagem::class, 'id_whatsapp_instancia', 'id_whatsapp_instancia');
    }

    public function conectada(): bool
    {
        return $this->status_conexao === 'open';
    }
}
