<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE usuario MODIFY perfil ENUM('ADMIN','GERENTE','CLIENTE','ENTREGADOR','ATENDENTE') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE usuario MODIFY perfil ENUM('ADMIN','GERENTE','CLIENTE','ENTREGADOR') NOT NULL");
    }
};
