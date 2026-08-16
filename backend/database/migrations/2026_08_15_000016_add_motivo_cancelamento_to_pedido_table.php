<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // Preenchido quando o estabelecimento recusa um pedido (principalmente os que vem
            // do canal ONLINE, onde o cliente precisa saber o motivo).
            $table->text('motivo_cancelamento')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropColumn('motivo_cancelamento');
        });
    }
};
