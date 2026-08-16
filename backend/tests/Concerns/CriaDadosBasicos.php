<?php

namespace Tests\Concerns;

use App\Models\Categoria;
use App\Models\Empresa;
use App\Models\Entregador;
use App\Models\Mesa;
use App\Models\Produto;
use App\Models\User;
use Illuminate\Support\Str;

trait CriaDadosBasicos
{
    protected function criarEmpresa(array $overrides = []): Empresa
    {
        return Empresa::create(array_merge([
            'nm_empresa' => 'Restaurante Teste',
            'cnpj' => (string) random_int(1000000000, 9999999999),
        ], $overrides));
    }

    protected function criarUsuario(string $perfil, array $overrides = []): User
    {
        return User::create(array_merge([
            'nm_usuario' => 'Usuario ' . Str::random(6),
            'email' => Str::uuid() . '@teste.local',
            'senha_hash' => bcrypt('senha12345'),
            'perfil' => $perfil,
            'fl_ativo' => true,
        ], $overrides));
    }

    protected function criarAdminComToken(): array
    {
        $admin = $this->criarUsuario('ADMIN', ['email' => 'admin+' . Str::uuid() . '@teste.local']);
        $token = $admin->createToken('teste')->plainTextToken;

        return [$admin, $token];
    }

    protected function criarEntregador(array $overrides = []): Entregador
    {
        $usuario = $this->criarUsuario('ENTREGADOR');

        return Entregador::create(array_merge([
            'id_usuario' => $usuario->id_usuario,
            'fl_online' => true,
        ], $overrides));
    }

    protected function criarCategoria(Empresa $empresa): Categoria
    {
        return Categoria::create([
            'id_empresa' => $empresa->id_empresa,
            'nm_categoria' => 'Categoria Teste',
            'fl_ativa' => true,
        ]);
    }

    protected function criarProduto(Empresa $empresa, Categoria $categoria, array $overrides = []): Produto
    {
        return Produto::create(array_merge([
            'id_empresa' => $empresa->id_empresa,
            'id_categoria' => $categoria->id_categoria,
            'nm_produto' => 'Produto Teste',
            'vl_preco_base' => 20.00,
            'fl_ativo' => true,
        ], $overrides));
    }

    protected function criarMesa(Empresa $empresa, array $overrides = []): Mesa
    {
        return Mesa::create(array_merge([
            'id_empresa' => $empresa->id_empresa,
            'nr_mesa' => random_int(100, 99999),
            'status_ocupacao' => 'LIVRE',
            'qr_code_token' => 'mesa-teste-' . Str::random(8),
            'capacidade' => 4,
        ], $overrides));
    }
}
