<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // Pedido presencial da mesa e um so, acumulando o consumo: cada nova rodada de
            // itens entra no mesmo pedido. Isso marca quando foi a ultima rodada (pra destacar
            // "novos itens" no card) e quantas rodadas ja entraram depois da primeira.
            $table->timestamp('dt_ultimo_acrescimo')->nullable()->after('dt_conclusao');
            $table->unsignedInteger('nr_acrescimos')->default(0)->after('dt_ultimo_acrescimo');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropColumn(['dt_ultimo_acrescimo', 'nr_acrescimos']);
        });
    }
};
