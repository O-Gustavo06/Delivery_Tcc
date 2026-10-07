<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente', function (Blueprint $table) {
            // Telefone passa a ser o identificador do cliente no autoatendimento da mesa
            // (bipa o QR, digita o telefone, cai na mesma comanda de sempre).
            $table->unique('telefone');
        });
    }

    public function down(): void
    {
        Schema::table('cliente', function (Blueprint $table) {
            $table->dropUnique(['telefone']);
        });
    }
};
