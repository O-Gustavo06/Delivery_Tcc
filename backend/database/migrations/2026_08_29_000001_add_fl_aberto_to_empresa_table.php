<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            // Toggle manual do admin - controla o indicador "Aberto/Fechado" no cardapio
            // online publico. Nao tem grade de horario cadastrada, e so um liga/desliga.
            $table->boolean('fl_aberto')->default(true)->after('chave_pix');
        });
    }

    public function down(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->dropColumn('fl_aberto');
        });
    }
};
