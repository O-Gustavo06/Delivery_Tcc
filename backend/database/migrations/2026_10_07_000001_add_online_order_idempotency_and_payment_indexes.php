<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido', function (Blueprint $table) {
            $table->string('idempotency_key', 36)->nullable()->unique('pedido_idempotency_key_unique');
            $table->index(['tipo_pedido', 'nr_pedido_delivery'], 'pedido_delivery_number_idx');
        });

        Schema::table('transacao_pagamento', function (Blueprint $table) {
            $table->unique(['provedor', 'nsu'], 'transacao_pagamento_provedor_nsu_unique');
        });
    }

    public function down(): void
    {
        Schema::table('transacao_pagamento', function (Blueprint $table) {
            $table->dropUnique('transacao_pagamento_provedor_nsu_unique');
        });

        Schema::table('pedido', function (Blueprint $table) {
            $table->dropIndex('pedido_delivery_number_idx');
            $table->dropUnique('pedido_idempotency_key_unique');
            $table->dropColumn('idempotency_key');
        });
    }
};
