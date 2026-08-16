<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rota_entrega_item', function (Blueprint $table) {
            $table->id('id_rota_entrega_item');
            $table->unsignedBigInteger('id_rota_entrega');
            $table->bigInteger('id_entrega');
            $table->unsignedInteger('ordem_sequencia');
            $table->timestamp('dt_entregue')->nullable();
            $table->timestamp('dt_cadastro')->useCurrent();

            $table->unique(['id_rota_entrega', 'id_entrega'], 'uk_rota_entrega_item');
            $table->foreign('id_rota_entrega')
                ->references('id_rota_entrega')->on('rota_entrega')->onDelete('cascade');
            $table->foreign('id_entrega')
                ->references('id_entrega')->on('entrega')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rota_entrega_item');
    }
};
