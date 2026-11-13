<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('produto_fiscal', function (Blueprint $table) {
            $table->bigInteger('id_produto')->primary();
            $table->string('ncm', 8)->nullable();
            $table->string('cest', 7)->nullable();
            $table->string('cfop', 4)->nullable();
            $table->string('cst_csosn', 3)->nullable();
            $table->string('origem', 1)->nullable();
            $table->decimal('aliquota_icms', 7, 4)->nullable();
            $table->decimal('aliquota_pis', 7, 4)->nullable();
            $table->decimal('aliquota_cofins', 7, 4)->nullable();
            $table->decimal('aliquota_ipi', 7, 4)->nullable();
            $table->text('informacoes_adicionais')->nullable();
            $table->dateTime('dt_atualizacao')->useCurrent();
            $table->foreign('id_produto')->references('id_produto')->on('produto')->onDelete('cascade');
        });

        Schema::create('empresa_fiscal', function (Blueprint $table) {
            $table->bigInteger('id_empresa')->primary();
            $table->string('regime', 30)->nullable();
            $table->string('uf', 2)->nullable();
            $table->string('inscricao_estadual', 30)->nullable();
            $table->dateTime('dt_atualizacao')->useCurrent();
            $table->foreign('id_empresa')->references('id_empresa')->on('empresa')->onDelete('cascade');
        });

        Schema::create('documento_fiscal', function (Blueprint $table) {
            $table->id('id_documento_fiscal');
            $table->bigInteger('id_empresa');
            $table->bigInteger('id_pedido')->nullable();
            $table->unsignedBigInteger('id_compra')->nullable();
            $table->string('modelo', 4);
            $table->string('direcao', 7);
            $table->string('status', 20)->default('RASCUNHO');
            $table->json('contexto_fiscal');
            $table->json('itens');
            $table->json('tributos')->nullable();
            $table->string('chave_acesso', 44)->nullable();
            $table->string('protocolo', 100)->nullable();
            $table->text('mensagem_status')->nullable();
            $table->string('caminho_xml')->nullable();
            $table->string('caminho_danfe')->nullable();
            $table->dateTime('dt_cadastro')->useCurrent();
            $table->dateTime('dt_atualizacao')->useCurrent();
            $table->foreign('id_empresa')->references('id_empresa')->on('empresa')->onDelete('restrict');
            $table->foreign('id_pedido')->references('id_pedido')->on('pedido')->onDelete('restrict');
            $table->foreign('id_compra')->references('id_compra')->on('compra')->onDelete('restrict');
            $table->index(['id_empresa', 'status', 'direcao']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_fiscal');
        Schema::dropIfExists('empresa_fiscal');
        Schema::dropIfExists('produto_fiscal');
    }
};
