<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscription', function (Blueprint $table) {
            $table->id('id_push_subscription');
            $table->bigInteger('id_pedido');
            // Formato padrao do PushSubscription.toJSON() do navegador: endpoint unico por
            // dispositivo/navegador, mais as duas chaves de criptografia da mensagem.
            $table->text('endpoint');
            $table->string('chave_p256dh', 255);
            $table->string('chave_auth', 255);
            $table->timestamp('dt_cadastro')->useCurrent();

            $table->foreign('id_pedido')->references('id_pedido')->on('pedido')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscription');
    }
};
