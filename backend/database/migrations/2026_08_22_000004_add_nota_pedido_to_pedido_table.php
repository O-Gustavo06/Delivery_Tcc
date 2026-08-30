<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // Observacao livre do pedido (ex: "sem cebola", "campainha nao funciona").
            // Separado de ds_observacao, que ja e usado pra guardar o endereco do delivery.
            $table->text('ds_nota_pedido')->nullable()->after('ds_observacao');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropColumn('ds_nota_pedido');
        });
    }
};
