<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingrediente', function (Blueprint $table) {
            // Saldo mantido de forma transacional a cada estoque_movimento (nao derivado por
            // soma toda hora) - estoque_movimento continua sendo o historico/auditoria completo.
            $table->decimal('qtd_atual', 12, 3)->default(0)->after('unidade');
        });
    }

    public function down(): void
    {
        Schema::table('ingrediente', function (Blueprint $table) {
            $table->dropColumn('qtd_atual');
        });
    }
};
