<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Perfil extends Model
{
    protected $table = 'perfil';
    protected $primaryKey = 'id_perfil';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = null;

    protected $fillable = [
        'nm_perfil',
        'ds_perfil',
        'permissoes_json',
        'fl_ativo',
    ];

    protected function casts(): array
    {
        return [
            'permissoes_json' => 'array',
            'fl_ativo' => 'boolean',
        ];
    }
}
