<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // Numeracao propria pra pedidos DELIVERY, comecando do 1, separada do id_pedido
            // global (que e compartilhado com MESA/BALCAO e confunde na tela de Pedidos e no
            // app do motoboy). Nula pra MESA/BALCAO, que continuam usando o id_pedido normal.
            $table->unsignedInteger('nr_pedido_delivery')->nullable()->after('tipo_pedido');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropColumn('nr_pedido_delivery');
        });
    }
};
