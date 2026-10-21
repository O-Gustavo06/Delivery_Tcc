<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promocao', function (Blueprint $table) {
            $table->bigIncrements('id_promocao');
            $table->bigInteger('id_empresa');
            $table->string('tipo', 20);
            $table->string('nome', 120);
            $table->string('codigo', 50)->nullable();
            $table->string('tipo_desconto', 20);
            $table->decimal('valor_desconto', 10, 2);
            $table->decimal('valor_minimo_pedido', 10, 2)->default(0);
            $table->unsignedInteger('limite_utilizacoes')->nullable();
            $table->unsignedInteger('limite_por_cliente')->nullable();
            $table->dateTime('dt_inicio');
            $table->dateTime('dt_fim')->nullable();
            $table->boolean('fl_ativa')->default(true);
            $table->timestamps();
            $table->foreign('id_empresa', 'promocao_empresa_fk')->references('id_empresa')->on('empresa')->cascadeOnDelete();
            $table->unique(['id_empresa', 'codigo'], 'promocao_empresa_codigo_unique');
            $table->index(['id_empresa', 'tipo', 'fl_ativa', 'dt_inicio', 'dt_fim'], 'promocao_vigencia_idx');
        });

        Schema::create('promocao_produto', function (Blueprint $table) {
            $table->unsignedBigInteger('id_promocao');
            $table->bigInteger('id_produto');
            $table->primary(['id_promocao', 'id_produto']);
            $table->foreign('id_promocao', 'promocao_produto_promocao_fk')->references('id_promocao')->on('promocao')->cascadeOnDelete();
            $table->foreign('id_produto', 'promocao_produto_produto_fk')->references('id_produto')->on('produto')->cascadeOnDelete();
        });

        Schema::create('promocao_categoria', function (Blueprint $table) {
            $table->unsignedBigInteger('id_promocao');
            $table->bigInteger('id_categoria');
            $table->primary(['id_promocao', 'id_categoria']);
            $table->foreign('id_promocao', 'promocao_categoria_promocao_fk')->references('id_promocao')->on('promocao')->cascadeOnDelete();
            $table->foreign('id_categoria', 'promocao_categoria_categoria_fk')->references('id_categoria')->on('categoria')->cascadeOnDelete();
        });

        Schema::create('promocao_utilizacao', function (Blueprint $table) {
            $table->bigIncrements('id_promocao_utilizacao');
            $table->unsignedBigInteger('id_promocao');
            $table->bigInteger('id_pedido');
            $table->bigInteger('id_cliente');
            $table->decimal('vl_desconto', 10, 2);
            $table->string('cd_aplicado', 50)->nullable();
            $table->dateTime('dt_utilizacao');
            $table->foreign('id_promocao', 'promocao_utilizacao_promocao_fk')->references('id_promocao')->on('promocao');
            $table->foreign('id_pedido', 'promocao_utilizacao_pedido_fk')->references('id_pedido')->on('pedido')->cascadeOnDelete();
            $table->foreign('id_cliente', 'promocao_utilizacao_cliente_fk')->references('id_cliente')->on('cliente');
            $table->index(['id_promocao', 'id_cliente'], 'promocao_utilizacao_cliente_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promocao_utilizacao');
        Schema::dropIfExists('promocao_categoria');
        Schema::dropIfExists('promocao_produto');
        Schema::dropIfExists('promocao');
    }
};
