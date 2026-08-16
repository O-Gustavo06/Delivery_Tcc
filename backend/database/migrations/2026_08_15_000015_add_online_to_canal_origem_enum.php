<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Novo canal: pedido feito pelo cliente direto no link publico do cardapio (nao e LOJA,
        // que hoje significa "digitado pelo atendente", nem IFOOD/99FOOD).
        DB::statement("ALTER TABLE pedido MODIFY canal_origem ENUM('LOJA', 'IFOOD', '99FOOD', 'ONLINE') DEFAULT 'LOJA'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE pedido MODIFY canal_origem ENUM('LOJA', 'IFOOD', '99FOOD') DEFAULT 'LOJA'");
    }
};
