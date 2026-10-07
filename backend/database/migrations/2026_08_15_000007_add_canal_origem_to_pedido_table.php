<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // De onde o pedido veio. Enquanto nao existe integracao real com iFood/99Food,
            // isso e escolhido manualmente na criacao do pedido pra simular o canal.
            $table->enum('canal_origem', ['LOJA', 'IFOOD', '99FOOD'])
                ->default('LOJA')
                ->after('tipo_pedido');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropColumn('canal_origem');
        });
    }
};
