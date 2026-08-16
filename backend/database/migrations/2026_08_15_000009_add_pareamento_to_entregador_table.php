<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entregador', function (Blueprint $table) {
            // Cadastro do motoboy pelo painel e so nome + telefone; a confirmacao de que o
            // aparelho realmente pertence a esse entregador acontece por QR (o admin mostra na
            // tela, o entregador bipa no app pra "parear" e ganhar o token de acesso).
            $table->string('codigo_pareamento', 20)->nullable()->unique()->after('veiculo_tipo');
            $table->timestamp('codigo_pareamento_expira_em')->nullable()->after('codigo_pareamento');
        });
    }

    public function down(): void
    {
        Schema::table('entregador', function (Blueprint $table) {
            $table->dropColumn(['codigo_pareamento', 'codigo_pareamento_expira_em']);
        });
    }
};
