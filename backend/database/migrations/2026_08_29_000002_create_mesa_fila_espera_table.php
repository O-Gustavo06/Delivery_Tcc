<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mesa_fila_espera', function (Blueprint $table) {
            $table->id('id_fila_espera');
            $table->bigInteger('id_empresa');
            $table->string('nm_cliente', 150);
            $table->unsignedSmallInteger('nr_pessoas');
            // Sem coluna de status: entrar na fila e um insert, ser chamado/desistir e um
            // delete (nao guarda historico, e so uma fila de espera do dia).
            $table->timestamp('dt_cadastro')->useCurrent();

            $table->foreign('id_empresa')->references('id_empresa')->on('empresa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mesa_fila_espera');
    }
};
