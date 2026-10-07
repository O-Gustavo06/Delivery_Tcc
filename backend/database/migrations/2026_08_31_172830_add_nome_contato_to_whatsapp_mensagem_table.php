<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('whatsapp_mensagem', function (Blueprint $table) {
            // Nome exibido no WhatsApp do contato (pushName mandado pela Evolution API) -
            // usado como fallback quando o telefone nao bate com nenhum Cliente cadastrado.
            $table->string('nome_contato', 100)->nullable()->after('telefone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('whatsapp_mensagem', function (Blueprint $table) {
            $table->dropColumn('nome_contato');
        });
    }
};
