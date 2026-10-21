<?php

namespace App\Services;

use App\Jobs\EnviarPesquisaPosVenda;
use App\Models\Comanda;
use App\Models\Pedido;
use App\Models\PosVenda;
use App\Models\WhatsappMensagem;
use Illuminate\Support\Str;

class PosVendaService
{
    public function agendarPedido(Pedido $pedido): ?PosVenda
    {
        $pedido->loadMissing('cliente');
        if ($pedido->status !== 'FINALIZADO' || $pedido->tipo_pedido === 'MESA') {
            return null;
        }

        return $this->criarPesquisa([
            'id_pedido' => $pedido->id_pedido,
            'id_cliente' => $pedido->id_cliente,
            'telefone' => $pedido->cliente?->telefone_normalizado,
        ]);
    }

    public function agendarComanda(Comanda $comanda): ?PosVenda
    {
        $comanda->loadMissing('pedidos.cliente');
        if ($comanda->status !== 'PAGA') {
            return null;
        }

        $pedido = $comanda->pedidos
            ->where('status', '!=', 'CANCELADO')
            ->first(fn (Pedido $item) => $item->cliente?->telefone_normalizado);
        $pedido ??= $comanda->pedidos->first(fn (Pedido $item) => $item->status !== 'CANCELADO');

        return $this->criarPesquisa([
            'id_comanda' => $comanda->id_comanda,
            'id_cliente' => $pedido?->id_cliente,
            'telefone' => $pedido?->cliente?->telefone_normalizado,
        ]);
    }

    public function registrarResposta(WhatsappMensagem $mensagem): void
    {
        $telefone = ClienteIdentityService::normalizarTelefone($mensagem->telefone);
        if (!$telefone || $mensagem->direcao !== 'ENTRADA' || !is_string($mensagem->conteudo)) {
            return;
        }

        $texto = trim($mensagem->conteudo);
        if ($texto === '') {
            return;
        }

        $pendente = PosVenda::where('telefone', $telefone)
            ->whereIn('status', ['ENVIANDO', 'ENVIADA'])
            ->orderByDesc('dt_enviado')
            ->first();

        if ($pendente) {
            $nota = $this->extrairNota($texto);
            if ($nota === null) {
                return;
            }

            $pendente->update([
                'status' => 'RESPONDIDA',
                'nota' => $nota,
                'ds_comentario' => null,
                'dt_resposta' => now(),
            ]);
            $mensagem->update(['id_pos_venda' => $pendente->id_pos_venda]);

            return;
        }

        $avaliacaoRecente = PosVenda::where('telefone', $telefone)
            ->where('status', 'RESPONDIDA')
            ->whereNotNull('nota')
            ->whereNull('ds_comentario')
            ->where('dt_resposta', '>=', now()->subMinutes(30))
            ->orderByDesc('dt_resposta')
            ->first();

        if ($avaliacaoRecente && !$this->extrairNota($texto)) {
            $avaliacaoRecente->update(['ds_comentario' => Str::limit($texto, 2000, '')]);
            $mensagem->update(['id_pos_venda' => $avaliacaoRecente->id_pos_venda]);
        }
    }

    private function criarPesquisa(array $identidade): ?PosVenda
    {
        $telefone = ClienteIdentityService::normalizarTelefone($identidade['telefone'] ?? null);
        $atrasoMinutos = max(0, (int) config('services.pos_venda.delay_minutes', 10));
        $atributos = [
            ...$identidade,
            'telefone' => $telefone,
            'status' => $telefone ? 'AGENDADA' : 'SEM_TELEFONE',
            'dt_envio_previsto' => $telefone ? now()->addMinutes($atrasoMinutos) : null,
        ];

        $chave = isset($identidade['id_pedido'])
            ? ['id_pedido' => $identidade['id_pedido']]
            : ['id_comanda' => $identidade['id_comanda']];

        $pesquisa = PosVenda::firstOrCreate($chave, $atributos);

        if ($pesquisa->wasRecentlyCreated && $pesquisa->status === 'AGENDADA') {
            EnviarPesquisaPosVenda::dispatch($pesquisa->id_pos_venda)
                ->delay($pesquisa->dt_envio_previsto);
        }

        return $pesquisa;
    }

    private function extrairNota(string $texto): ?int
    {
        return preg_match('/^\s*([1-5])\s*$/u', $texto, $matches)
            ? (int) $matches[1]
            : null;
    }
}
