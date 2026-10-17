<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Novo canal: pedido feito pelo proprio cliente no cardapio presencial (/presencial),
        // dentro do restaurante - nao e LOJA (digitado pelo atendente) nem ONLINE (delivery).
        DB::statement("ALTER TABLE pedido MODIFY canal_origem ENUM('LOJA', 'IFOOD', '99FOOD', 'ONLINE', 'PRESENCIAL') DEFAULT 'LOJA'");
    }

    public function down(): void
    {
        DB::statement("UPDATE pedido SET canal_origem = 'LOJA' WHERE canal_origem = 'PRESENCIAL'");
        DB::statement("ALTER TABLE pedido MODIFY canal_origem ENUM('LOJA', 'IFOOD', '99FOOD', 'ONLINE') DEFAULT 'LOJA'");
    }
};
