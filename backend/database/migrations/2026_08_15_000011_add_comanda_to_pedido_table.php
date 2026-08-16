<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // So preenchido pra pedidos MESA feitos pelo autoatendimento (QR da mesa): agrupa
            // varios pedidos da mesma sentada pra fechar tudo junto no fim.
            $table->unsignedBigInteger('id_comanda')->nullable()->after('id_mesa');
            $table->foreign('id_comanda')->references('id_comanda')->on('comanda');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropForeign(['id_comanda']);
            $table->dropColumn('id_comanda');
        });
    }
};
