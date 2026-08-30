<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_mensagem', function (Blueprint $table) {
            $table->id('id_whatsapp_mensagem');
            $table->unsignedBigInteger('id_whatsapp_instancia');
            // Nulo quando o telefone remetente/destinatario nao bate com nenhum cliente
            // cadastrado (ex: numero avulso escrevendo antes de fazer o primeiro pedido).
            $table->bigInteger('id_cliente')->nullable();
            $table->enum('direcao', ['ENTRADA', 'SAIDA']);
            $table->string('telefone', 20);
            $table->text('conteudo')->nullable();
            $table->string('tipo', 30)->default('texto');
            // Id da mensagem na Evolution/WhatsApp (key.id do Baileys) - permite casar evento
            // de "message.update" (entregue/lido) com a mensagem ja registrada, sem duplicar.
            $table->string('id_externo', 100)->nullable();
            $table->string('status_envio', 20)->nullable();
            $table->dateTime('dt_mensagem');
            $table->dateTime('dt_cadastro')->useCurrent();

            $table->foreign('id_whatsapp_instancia')->references('id_whatsapp_instancia')->on('whatsapp_instancia')->onDelete('cascade');
            $table->foreign('id_cliente')->references('id_cliente')->on('cliente')->onDelete('set null');
            $table->index(['id_whatsapp_instancia', 'telefone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_mensagem');
    }
};
