<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entrega', function (Blueprint $table) {
            // Código exigido por plataformas externas (iFood, 99Food) para validar a entrega.
            $table->string('codigo_confirmacao_entrega', 20)->nullable()->after('id_entregador');
        });
    }

    public function down(): void
    {
        Schema::table('entrega', function (Blueprint $table) {
            $table->dropColumn('codigo_confirmacao_entrega');
        });
    }
};
