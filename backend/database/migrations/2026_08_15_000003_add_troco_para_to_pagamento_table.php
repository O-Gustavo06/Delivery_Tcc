<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagamento', function (Blueprint $table) {
            // Preenchido só quando forma = DINHEIRO. Valor que o cliente vai dar (p/ calcular troco).
            $table->decimal('troco_para', 10, 2)->nullable()->after('forma');
        });
    }

    public function down(): void
    {
        Schema::table('pagamento', function (Blueprint $table) {
            $table->dropColumn('troco_para');
        });
    }
};
