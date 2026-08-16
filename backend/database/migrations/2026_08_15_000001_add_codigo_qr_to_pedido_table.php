<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            // Token único gerado na impressão da comanda, usado no QR Code/código de barras.
            $table->string('codigo_qr', 100)->nullable()->unique()->after('id_mesa');
        });
    }

    public function down(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->dropUnique(['codigo_qr']);
            $table->dropColumn('codigo_qr');
        });
    }
};
