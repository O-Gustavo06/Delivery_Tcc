<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('compra_item', function (Blueprint $table) {
            $table->id('id_compra_item');
            $table->unsignedBigInteger('id_compra');
            $table->bigInteger('id_ingrediente');
            $table->decimal('qtde', 10, 3);
            $table->decimal('vl_unitario', 10, 2);
            $table->decimal('vl_subtotal', 12, 2);

            $table->foreign('id_compra')->references('id_compra')->on('compra')->onDelete('cascade');
            $table->foreign('id_ingrediente')->references('id_ingrediente')->on('ingrediente')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compra_item');
    }
};
