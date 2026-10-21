<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cliente', function (Blueprint $table) {
            $table->string('telefone_normalizado', 20)->nullable()->after('telefone');
            $table->bigInteger('id_cliente_principal')->nullable()->after('telefone_normalizado');
            $table->foreign('id_cliente_principal')
                ->references('id_cliente')
                ->on('cliente')
                ->nullOnDelete();
        });

        $clientes = DB::table('cliente')
            ->select('id_cliente', 'telefone', 'cpf')
            ->orderBy('id_cliente')
            ->get();
        $principais = [];
        $cpfPrincipais = [];

        foreach ($clientes as $cliente) {
            $telefone = $this->normalizarTelefone($cliente->telefone);
            if (!$telefone) {
                continue;
            }

            if (!isset($principais[$telefone])) {
                $principais[$telefone] = (int) $cliente->id_cliente;
                $cpfPrincipais[$telefone] = $cliente->cpf;
                DB::table('cliente')
                    ->where('id_cliente', $cliente->id_cliente)
                    ->update(['telefone_normalizado' => $telefone]);

                continue;
            }

            $idPrincipal = $principais[$telefone];
            foreach (['pedido', 'avaliacao', 'whatsapp_mensagem', 'promocao_utilizacao'] as $tabela) {
                if (Schema::hasTable($tabela) && Schema::hasColumn($tabela, 'id_cliente')) {
                    DB::table($tabela)
                        ->where('id_cliente', $cliente->id_cliente)
                        ->update(['id_cliente' => $idPrincipal]);
                }
            }

            if (!$cpfPrincipais[$telefone] && $cliente->cpf) {
                DB::table('cliente')
                    ->where('id_cliente', $cliente->id_cliente)
                    ->update(['cpf' => null]);
                DB::table('cliente')
                    ->where('id_cliente', $idPrincipal)
                    ->whereNull('cpf')
                    ->update(['cpf' => $cliente->cpf]);
                $cpfPrincipais[$telefone] = $cliente->cpf;
            }

            DB::table('cliente')
                ->where('id_cliente', $cliente->id_cliente)
                ->update([
                    'telefone_normalizado' => null,
                    'id_cliente_principal' => $idPrincipal,
                ]);
        }

        if (Schema::hasTable('whatsapp_mensagem')) {
            DB::table('whatsapp_mensagem')
                ->select('id_whatsapp_mensagem', 'telefone', 'id_cliente')
                ->orderBy('id_whatsapp_mensagem')
                ->chunkById(500, function ($mensagens) use ($principais) {
                    foreach ($mensagens as $mensagem) {
                        $telefone = $this->normalizarTelefone($mensagem->telefone);
                        if (!$telefone) {
                            continue;
                        }

                        $atualizacoes = ['telefone' => $telefone];
                        if (!$mensagem->id_cliente && isset($principais[$telefone])) {
                            $atualizacoes['id_cliente'] = $principais[$telefone];
                        }

                        DB::table('whatsapp_mensagem')
                            ->where('id_whatsapp_mensagem', $mensagem->id_whatsapp_mensagem)
                            ->update($atualizacoes);
                    }
                }, 'id_whatsapp_mensagem');
        }

        Schema::table('cliente', function (Blueprint $table) {
            $table->unique('telefone_normalizado', 'cliente_telefone_normalizado_unique');
        });
    }

    public function down(): void
    {
        Schema::table('cliente', function (Blueprint $table) {
            $table->dropUnique('cliente_telefone_normalizado_unique');
            $table->dropForeign(['id_cliente_principal']);
            $table->dropColumn(['telefone_normalizado', 'id_cliente_principal']);
        });
    }

    private function normalizarTelefone(?string $telefone): ?string
    {
        $digitos = preg_replace('/\D+/', '', $telefone ?? '');
        if ($digitos === '') {
            return null;
        }

        if (str_starts_with($digitos, '00')) {
            $digitos = substr($digitos, 2);
        }
        if (strlen($digitos) > 11 && str_starts_with($digitos, '55')) {
            $digitos = substr($digitos, 2);
        }

        $digitos = substr($digitos, -11);

        return strlen($digitos) >= 10 ? '55' . $digitos : null;
    }
};
