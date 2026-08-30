<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_instancia', function (Blueprint $table) {
            $table->id('id_whatsapp_instancia');
            $table->bigInteger('id_empresa');
            // Nome/chave da instancia na Evolution API (unico globalmente la, nao so por
            // empresa) - gerado a partir do id da empresa na criacao, nunca editado pelo usuario.
            $table->string('nm_instancia', 100)->unique();
            // Token de autenticacao da instancia devolvido pela Evolution API na criacao. Nao e
            // exposto pro frontend, so usado internamente pelo EvolutionApiService se precisar.
            $table->string('token_instancia', 255)->nullable();
            // Espelha o "state" da Evolution API (close|connecting|open), atualizado via
            // polling do status ou via webhook de connection.update.
            $table->string('status_conexao', 20)->default('close');
            $table->string('nr_telefone', 20)->nullable();
            $table->boolean('fl_webhook_configurado')->default(false);
            $table->dateTime('dt_conectado')->nullable();
            $table->json('configuracoes')->nullable();
            $table->dateTime('dt_cadastro')->useCurrent();
            $table->dateTime('dt_atualizacao')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('id_empresa')->references('id_empresa')->on('empresa')->onDelete('cascade');
            // Uma instancia de WhatsApp por empresa, por enquanto.
            $table->unique('id_empresa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_instancia');
    }
};
