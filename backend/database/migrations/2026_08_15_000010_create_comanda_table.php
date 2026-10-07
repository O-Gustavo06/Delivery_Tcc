<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comanda', function (Blueprint $table) {
            $table->id('id_comanda');
            $table->bigInteger('id_mesa');
            // ABERTA: recebendo pedidos. AGUARDANDO_PAGAMENTO: cliente/garcom pediu pra fechar,
            // esperando o caixa confirmar (Pix "ja paguei" ou cartao/dinheiro conferido na mesa).
            // PAGA: confirmado, mesa liberada. CANCELADA: fechada sem cobranca (erro, mesa vazia etc.).
            $table->enum('status', ['ABERTA', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'CANCELADA'])->default('ABERTA');
            $table->enum('forma_pagamento', ['PIX', 'CARTAO', 'DINHEIRO'])->nullable();
            $table->bigInteger('id_usuario_confirmou')->nullable();
            $table->timestamp('dt_fechamento')->nullable();
            $table->timestamp('dt_cadastro')->useCurrent();
            $table->timestamp('dt_atualizacao')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('id_mesa')->references('id_mesa')->on('mesa');
            $table->foreign('id_usuario_confirmou')->references('id_usuario')->on('usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comanda');
    }
};
