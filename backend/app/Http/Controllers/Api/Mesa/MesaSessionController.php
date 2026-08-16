<?php

namespace App\Http\Controllers\Api\Mesa;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Comanda;
use App\Models\ItemPedido;
use App\Models\Mesa;
use App\Models\Pagamento;
use App\Models\Pedido;
use App\Models\Produto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Autoatendimento da mesa: o cliente bipa o QR impresso na mesa (mesa.qr_code_token),
 * se identifica pelo telefone, ve o cardapio de verdade e pede direto por aqui. Tudo publico
 * (sem token de acesso) - a "seguranca" e o token aleatorio do QR, igual ao codigo_qr do pedido.
 */
class MesaSessionController extends Controller
{
    /**
     * GET /mesa/{token}
     * Estado atual da mesa: comanda aberta (se houver, com o que ja foi pedido) + cardapio.
     */
    public function show(Request $request, string $token): JsonResponse
    {
        $mesa = Mesa::where('qr_code_token', $token)->first();

        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        $comanda = $mesa->comandaAberta()
            ->with(['pedidos.itens.produto', 'pedidos.cliente.usuario'])
            ->first();

        $produtos = Produto::where('id_empresa', $mesa->id_empresa)
            ->where('fl_ativo', true)
            ->with('categoria')
            ->orderBy('nm_produto')
            ->get();

        return response()->json([
            'mesa' => [
                'id' => $mesa->id_mesa,
                'numero' => $mesa->nr_mesa,
                'capacidade' => $mesa->capacidade,
            ],
            'comanda' => $comanda ? $this->comandaPayload($comanda) : null,
            'produtos' => $produtos->map(fn (Produto $produto) => [
                'id' => $produto->id_produto,
                'nome' => $produto->nm_produto,
                'descricao' => $produto->ds_produto,
                'preco' => (float) $produto->vl_preco_base,
                'categoria' => $produto->categoria?->nm_categoria,
                'imagem' => self::resolveImagemUrl($request, $produto->url_imagem),
            ])->values(),
        ]);
    }

    /**
     * url_imagem no banco guarda so o caminho relativo (/images/produtos/x.jpg) - a URL
     * completa e montada na hora, usando o host que o cliente usou pra acessar a API. Isso
     * evita salvar "localhost" fixo no banco e quebrar o acesso via IP da rede (celular).
     */
    public static function resolveImagemUrl(Request $request, ?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return $request->getSchemeAndHttpHost() . $path;
    }

    /**
     * POST /mesa/{token}/identificar
     * Body: { telefone, nome?, cpf? }
     * Primeira vez na mesa: precisa nome (mini-cadastro). Depois disso, so o telefone basta.
     * Tambem garante que existe uma comanda aberta pra essa mesa (cria se for a primeira pessoa).
     */
    public function identificar(Request $request, string $token): JsonResponse
    {
        $mesa = Mesa::where('qr_code_token', $token)->first();
        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        $data = $request->validate([
            'telefone' => ['required', 'string', 'max:20'],
            'nome' => ['nullable', 'string', 'max:150'],
            'cpf' => ['nullable', 'string', 'max:14'],
        ]);

        $cliente = Cliente::with('usuario')->where('telefone', $data['telefone'])->first();

        if (!$cliente) {
            if (empty($data['nome'])) {
                return response()->json([
                    'message' => 'Primeira vez aqui? Preciso do seu nome tambem.',
                    'novo_cliente' => true,
                ], 422);
            }

            $cliente = DB::transaction(function () use ($data) {
                $emailSintetico = strtolower(preg_replace('/\s+/', '.', trim($data['nome'])))
                    . '+' . now()->timestamp . '@cliente.local';

                $usuario = \App\Models\User::create([
                    'nm_usuario' => $data['nome'],
                    'email' => $emailSintetico,
                    'senha_hash' => bcrypt(Str::random(40)),
                    'perfil' => 'CLIENTE',
                    'fl_ativo' => true,
                ]);

                return Cliente::create([
                    'id_usuario' => $usuario->id_usuario,
                    'telefone' => $data['telefone'],
                    'cpf' => $data['cpf'] ?? null,
                ])->load('usuario');
            });
        }

        $comanda = $mesa->comandaAberta()->first();
        if (!$comanda) {
            $comanda = Comanda::create(['id_mesa' => $mesa->id_mesa, 'status' => 'ABERTA']);
            $mesa->update(['status_ocupacao' => 'OCUPADA']);
        }

        return response()->json([
            'cliente' => [
                'id' => $cliente->id_cliente,
                'nome' => $cliente->usuario?->nm_usuario,
            ],
            'id_comanda' => $comanda->id_comanda,
        ]);
    }

    /**
     * POST /mesa/{token}/pedidos
     * Body: { id_cliente, items: [{ id_produto, qty }] }
     * Preco sempre vem do catalogo (nunca do cliente) - evita manipulacao no autoatendimento.
     */
    public function pedido(Request $request, string $token): JsonResponse
    {
        $mesa = Mesa::where('qr_code_token', $token)->first();
        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        $comanda = $mesa->comandaAberta()->first();
        if (!$comanda || $comanda->status !== 'ABERTA') {
            return response()->json(['message' => 'Essa comanda ja foi fechada. Chame o garcom.'], 422);
        }

        $data = $request->validate([
            'id_cliente' => ['required', 'integer', 'exists:cliente,id_cliente'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id_produto' => ['required', 'integer', 'exists:produto,id_produto'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $produtos = Produto::whereIn('id_produto', collect($data['items'])->pluck('id_produto'))
            ->where('id_empresa', $mesa->id_empresa)
            ->where('fl_ativo', true)
            ->get()
            ->keyBy('id_produto');

        $pedido = DB::transaction(function () use ($data, $mesa, $comanda, $produtos) {
            $total = 0;
            foreach ($data['items'] as $item) {
                $produto = $produtos->get($item['id_produto']);
                if ($produto) {
                    $total += (float) $produto->vl_preco_base * $item['qty'];
                }
            }

            $pedido = Pedido::create([
                'id_empresa' => $mesa->id_empresa,
                'id_cliente' => $data['id_cliente'],
                'id_mesa' => $mesa->id_mesa,
                'id_comanda' => $comanda->id_comanda,
                'codigo_qr' => (string) Str::uuid(),
                'tipo_pedido' => 'MESA',
                'canal_origem' => 'LOJA',
                // O cliente ja esta fisicamente na mesa - nao faz sentido esperar um atendente
                // clicar "enviar cozinha" manualmente. Entra direto na fila da cozinha (CONFIRMADO);
                // quem decide quando comecar a preparar de fato e a propria cozinha.
                'status' => 'CONFIRMADO',
                'vl_total' => round($total, 2),
                'vl_taxa_entrega' => 0,
            ]);

            foreach ($data['items'] as $item) {
                $produto = $produtos->get($item['id_produto']);
                if (!$produto) {
                    continue;
                }

                ItemPedido::create([
                    'id_pedido' => $pedido->id_pedido,
                    'id_produto' => $produto->id_produto,
                    'nr_quantidade' => $item['qty'],
                    'vl_preco_unitario' => $produto->vl_preco_base,
                    'vl_subtotal' => round((float) $produto->vl_preco_base * $item['qty'], 2),
                ]);
            }

            // Forma real so se sabe no fechamento; PIX aqui e so placeholder (coluna nao aceita nulo).
            Pagamento::create([
                'id_pedido' => $pedido->id_pedido,
                'forma' => 'PIX',
                'status' => 'PENDENTE',
                'vl_total' => round($total, 2),
                'vl_desconto' => 0,
                'vl_final' => round($total, 2),
            ]);

            return $pedido;
        });

        $comanda = $comanda->fresh(['pedidos.itens.produto', 'pedidos.cliente.usuario']);

        return response()->json($this->comandaPayload($comanda), 201);
    }

    /**
     * POST /mesa/{token}/fechar
     * Body: { id_cliente, forma_pagamento }
     * PIX: cliente ja vai ver a chave e marcar "ja paguei" (isso so avisa o caixa). Cartao/dinheiro:
     * so avisa o caixa que a mesa quer fechar - o garcom confere o pagamento fisicamente.
     * Em qualquer caso quem libera a mesa de fato e o caixa, em /admin/comandas/{id}/confirmar-pagamento.
     */
    public function fechar(Request $request, string $token): JsonResponse
    {
        $mesa = Mesa::where('qr_code_token', $token)->first();
        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        $data = $request->validate([
            'forma_pagamento' => ['required', 'string', 'in:pix,cartao,dinheiro'],
        ]);

        $formaPagamento = strtoupper($data['forma_pagamento']);

        $comanda = $mesa->comandaAberta()->first();
        if (!$comanda) {
            return response()->json(['message' => 'Nenhuma comanda aberta pra essa mesa.'], 404);
        }

        if ($comanda->status === 'ABERTA') {
            DB::transaction(function () use ($comanda, $formaPagamento) {
                $comanda->update(['status' => 'AGUARDANDO_PAGAMENTO', 'forma_pagamento' => $formaPagamento]);
                Pagamento::whereIn('id_pedido', $comanda->pedidos()->pluck('id_pedido'))
                    ->update(['forma' => $formaPagamento]);
            });
        }

        $empresa = $mesa->empresa;
        $comanda = $comanda->fresh(['pedidos.itens.produto', 'pedidos.cliente.usuario']);

        return response()->json([
            ...$this->comandaPayload($comanda),
            'chave_pix' => $formaPagamento === 'PIX' ? $empresa?->chave_pix : null,
        ]);
    }

    private function comandaPayload(Comanda $comanda): array
    {
        return [
            'id_comanda' => $comanda->id_comanda,
            'status' => $comanda->status,
            'forma_pagamento' => $comanda->forma_pagamento,
            'total' => (float) $comanda->pedidos->sum('vl_total'),
            'pedidos' => $comanda->pedidos->map(fn (Pedido $pedido) => [
                'id_pedido' => $pedido->id_pedido,
                'cliente_nome' => $pedido->cliente?->usuario?->nm_usuario,
                'status' => $pedido->status,
                'total' => (float) $pedido->vl_total,
                'itens' => $pedido->itens->map(fn (ItemPedido $item) => [
                    'nome' => $item->produto?->nm_produto,
                    'qty' => (int) $item->nr_quantidade,
                    'preco' => (float) $item->vl_preco_unitario,
                ]),
            ]),
        ];
    }
}
