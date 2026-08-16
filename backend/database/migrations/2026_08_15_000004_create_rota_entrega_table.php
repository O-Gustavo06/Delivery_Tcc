<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rota_entrega', function (Blueprint $table) {
            $table->id('id_rota_entrega');
            $table->bigInteger('id_entregador');
            $table->enum('status', ['MONTANDO', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'])
                ->default('MONTANDO');
            // Sequência otimizada de paradas retornada pela API de rotas (Google Distance Matrix/Directions).
            $table->json('ordem_otimizada_json')->nullable();
            $table->timestamp('dt_cadastro')->useCurrent();
            $table->timestamp('dt_atualizacao')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('id_entregador')
                ->references('id_entregador')->on('entregador');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rota_entrega');
    }
};
