<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entregador', function (Blueprint $table) {
            // CPF nao e mais exigido no cadastro rapido de entregador pelo painel;
            // pode ser preenchido depois. Unicidade continua valendo pra quem tiver.
            $table->string('cpf', 14)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('entregador', function (Blueprint $table) {
            $table->string('cpf', 14)->nullable(false)->change();
        });
    }
};
