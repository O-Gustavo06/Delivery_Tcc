<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use App\Models\Cliente;
use App\Models\Entregador;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'usuario';
    protected $primaryKey = 'id_usuario';
    public $timestamps = false;

    protected $fillable = [
        'nm_usuario',
        'email',
        'senha_hash',
        'perfil',
        'fl_ativo',
    ];

    protected $hidden = [
        'senha_hash',
    ];

    protected function casts(): array
    {
        return [
            'fl_ativo' => 'boolean',
        ];
    }

    public function getAuthPassword(): string
    {
        return $this->senha_hash;
    }

    public function cliente()
    {
        return $this->hasOne(Cliente::class, 'id_usuario', 'id_usuario');
    }

    public function entregador()
    {
        return $this->hasOne(Entregador::class, 'id_usuario', 'id_usuario');
    }
}
