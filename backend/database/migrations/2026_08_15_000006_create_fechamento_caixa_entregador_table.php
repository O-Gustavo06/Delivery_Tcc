<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fechamento_caixa_entregador', function (Blueprint $table) {
            $table->id('id_fechamento');
            $table->bigInteger('id_entregador');
            $table->date('dt_referencia');
            $table->unsignedInteger('qtd_entregas')->default(0);
            $table->decimal('vl_total_taxas', 12, 2)->default(0);
            $table->decimal('vl_dinheiro_recebido', 12, 2)->default(0);
            $table->enum('status_pagamento', ['PENDENTE', 'PAGO'])->default('PENDENTE');
            $table->timestamp('dt_fechamento')->nullable();
            $table->timestamp('dt_cadastro')->useCurrent();

            $table->unique(['id_entregador', 'dt_referencia'], 'uk_fechamento_entregador_data');
            $table->foreign('id_entregador')
                ->references('id_entregador')->on('entregador');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fechamento_caixa_entregador');
    }
};
