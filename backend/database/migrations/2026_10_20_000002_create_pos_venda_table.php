<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_venda', function (Blueprint $table) {
            $table->id('id_pos_venda');
            $table->bigInteger('id_pedido')->nullable();
            $table->unsignedBigInteger('id_comanda')->nullable();
            $table->bigInteger('id_cliente')->nullable();
            $table->string('telefone', 20)->nullable();
            $table->string('status', 24)->default('AGENDADA');
            $table->unsignedTinyInteger('nota')->nullable();
            $table->text('ds_comentario')->nullable();
            $table->dateTime('dt_envio_previsto')->nullable();
            $table->dateTime('dt_enviado')->nullable();
            $table->dateTime('dt_resposta')->nullable();
            $table->timestamps();

            $table->foreign('id_pedido')->references('id_pedido')->on('pedido')->nullOnDelete();
            $table->foreign('id_comanda')->references('id_comanda')->on('comanda')->nullOnDelete();
            $table->foreign('id_cliente')->references('id_cliente')->on('cliente')->nullOnDelete();
            $table->unique('id_pedido', 'pos_venda_pedido_unique');
            $table->unique('id_comanda', 'pos_venda_comanda_unique');
            $table->index(['status', 'dt_envio_previsto'], 'pos_venda_status_envio_idx');
            $table->index(['id_cliente', 'dt_enviado'], 'pos_venda_cliente_envio_idx');
        });

        Schema::table('whatsapp_mensagem', function (Blueprint $table) {
            $table->unsignedBigInteger('id_pos_venda')->nullable()->after('id_cliente');
            $table->foreign('id_pos_venda')
                ->references('id_pos_venda')
                ->on('pos_venda')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_mensagem', function (Blueprint $table) {
            $table->dropForeign(['id_pos_venda']);
            $table->dropColumn('id_pos_venda');
        });

        Schema::dropIfExists('pos_venda');
    }
};
