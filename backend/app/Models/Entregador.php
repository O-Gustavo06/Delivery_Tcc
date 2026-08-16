<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;
use App\Models\Entrega;
use App\Models\Avaliacao;

class Entregador extends Model
{
    protected $table = 'entregador';
    protected $primaryKey = 'id_entregador';

    const CREATED_AT = 'dt_cadastro';
    const UPDATED_AT = 'dt_atualizacao';

    protected $fillable = [
        'id_usuario',
        'cpf',
        'telefone',
        'fl_online',
        'latitude',
        'longitude',
        'veiculo_tipo',
        'codigo_pareamento',
        'codigo_pareamento_expira_em',
        'dt_ultima_localizacao',
    ];

    protected function casts(): array
    {
        return [
            'fl_online' => 'boolean',
            'dt_ultima_localizacao' => 'datetime',
            'codigo_pareamento_expira_em' => 'datetime',
        ];
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'id_usuario', 'id_usuario');
    }

    public function entregas()
    {
        return $this->hasMany(Entrega::class, 'id_entregador', 'id_entregador');
    }

    public function avaliacoes()
    {
        return $this->hasMany(Avaliacao::class, 'id_entregador', 'id_entregador');
    }

    public function rotas()
    {
        return $this->hasMany(RotaEntrega::class, 'id_entregador', 'id_entregador');
    }

    public function rotaAtiva()
    {
        return $this->hasOne(RotaEntrega::class, 'id_entregador', 'id_entregador')
            ->whereIn('status', ['MONTANDO', 'EM_ANDAMENTO'])
            ->latestOfMany('id_rota_entrega');
    }

    public function fechamentos()
    {
        return $this->hasMany(FechamentoCaixaEntregador::class, 'id_entregador', 'id_entregador');
    }
}
