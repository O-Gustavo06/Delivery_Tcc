<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('compra', function (Blueprint $table) {
            $table->id('id_compra');
            $table->bigInteger('id_empresa');
            $table->bigInteger('id_usuario');
            $table->string('ds_descricao', 255)->nullable();
            $table->string('nm_fornecedor', 150)->nullable();
            $table->decimal('vl_total', 12, 2)->default(0);
            $table->dateTime('dt_compra');
            $table->dateTime('dt_cadastro')->useCurrent();

            $table->foreign('id_empresa')->references('id_empresa')->on('empresa')->onDelete('cascade');
            $table->foreign('id_usuario')->references('id_usuario')->on('usuario')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compra');
    }
};
