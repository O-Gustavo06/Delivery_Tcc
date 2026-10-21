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
use App\Services\ClienteIdentityService;
use App\Services\PromocaoService;
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
            'empresa' => [
                'nome' => $mesa->empresa?->nm_empresa,
                'chave_pix' => $mesa->empresa?->chave_pix,
            ],
            'comanda' => $comanda ? $this->comandaPayload($comanda) : null,
            'produtos' => $produtos->map(fn (Produto $produto) => [
                'id' => $produto->id_produto,
                'nome' => $produto->nm_produto,
                'descricao' => $produto->ds_produto,
                'preco' => (float) $produto->vl_preco_base,
                'categoria' => $produto->categoria?->nm_categoria,
                'categoria_id' => (int) $produto->id_categoria,
                'imagem' => self::resolveImagemUrl($request, $produto->url_imagem),
            ])->values(),
            'promocoes' => app(PromocaoService::class)->campanhasPublicas((int) $mesa->id_empresa),
        ]);
    }

    /**
     * POST /mesa/{token}/ocupar
     * Chamado assim que o cliente le o QR da mesa (cardapio presencial): abre a comanda e
     * marca a mesa como OCUPADA na hora, sem esperar o primeiro pedido nem identificacao.
     * Idempotente - se a mesa ja tem comanda aberta, so devolve o estado atual.
     */
    public function ocupar(Request $request, string $token): JsonResponse
    {
        $mesa = Mesa::where('qr_code_token', $token)->first();

        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        self::garantirComandaAberta($mesa);

        return $this->show($request, $token);
    }

    /** Comanda aberta da mesa (cria se nao houver) + mesa marcada como OCUPADA. */
    private static function garantirComandaAberta(Mesa $mesa): Comanda
    {
        return DB::transaction(function () use ($mesa) {
            // lockForUpdate: dois celulares lendo o QR ao mesmo tempo nao abrem duas comandas.
            Mesa::whereKey($mesa->id_mesa)->lockForUpdate()->first();

            $comanda = $mesa->comandaAberta()->first();
            if (!$comanda) {
                $comanda = Comanda::create(['id_mesa' => $mesa->id_mesa, 'status' => 'ABERTA']);
            }

            if ($mesa->status_ocupacao !== 'OCUPADA') {
                $mesa->update(['status_ocupacao' => 'OCUPADA']);
            }

            return $comanda;
        });
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

        $identity = app(ClienteIdentityService::class);
        $cliente = $identity->buscarPorTelefone($data['telefone']);

        if (!$cliente) {
            if (empty($data['nome'])) {
                return response()->json([
                    'message' => 'Primeira vez aqui? Preciso do seu nome tambem.',
                    'novo_cliente' => true,
                ], 422);
            }

            $cliente = $identity->buscarOuCriar($data['nome'], $data['telefone'], $data['cpf'] ?? null);
        }

        $comanda = self::garantirComandaAberta($mesa);

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
     * Body: { id_cliente? | nome?, items: [{ id_produto, qty, note? }] }
     * id_cliente: fluxo da /mesa (cliente ja se identificou pelo telefone). nome: cardapio
     * presencial (QR da mesa), onde o cliente so informa o nome - vira um cliente novo na
     * primeira vez e o front reaproveita o id_cliente devolvido nos proximos pedidos.
     * Preco sempre vem do catalogo (nunca do cliente) - evita manipulacao no autoatendimento.
     */
    public function pedido(Request $request, string $token): JsonResponse
    {
        $mesa = Mesa::where('qr_code_token', $token)->first();
        if (!$mesa) {
            return response()->json(['message' => 'Mesa nao encontrada.'], 404);
        }

        $data = $request->validate([
            'id_cliente' => ['nullable', 'integer', 'exists:cliente,id_cliente', 'required_without:nome'],
            'nome' => ['nullable', 'string', 'max:150', 'required_without:id_cliente'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id_produto' => ['required', 'integer', 'exists:produto,id_produto'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.note' => ['nullable', 'string', 'max:300'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
        ]);

        $comanda = $mesa->comandaAberta()->first();
        if ($comanda && $comanda->status !== 'ABERTA') {
            return response()->json(['message' => 'A conta dessa mesa ja foi pedida. Chame o garcom.'], 422);
        }
        // Mesa sem comanda (ex.: caixa liberou e o cliente continuou pedindo): reabre na hora.
        $comanda ??= self::garantirComandaAberta($mesa);

        $identity = app(ClienteIdentityService::class);
        if (!empty($data['id_cliente'])) {
            $data['id_cliente'] = $identity->resolverPorId((int) $data['id_cliente'])?->id_cliente;
        } elseif (!empty($data['telefone'])) {
            $data['id_cliente'] = $identity->buscarPorTelefone($data['telefone'])?->id_cliente;
        }

        if (empty($data['id_cliente'])) {
            $data['id_cliente'] = $identity
                ->buscarOuCriar($data['nome'], $data['telefone'] ?? null)
                ->id_cliente;
        }

        $produtos = Produto::whereIn('id_produto', collect($data['items'])->pluck('id_produto'))
            ->where('id_empresa', $mesa->id_empresa)
            ->where('fl_ativo', true)
            ->get()
            ->keyBy('id_produto');

        $nomeCliente = !empty($data['nome'])
            ? trim($data['nome'])
            : $identity->resolverPorId((int) $data['id_cliente'])?->usuario?->nm_usuario;

        [$pedido, $calculation] = DB::transaction(function () use ($data, $mesa, $comanda, $produtos, $nomeCliente) {
            $calculation = app(PromocaoService::class)->calcular(
                (int) $mesa->id_empresa,
                $data['items'],
                $produtos,
                $data['coupon_code'] ?? null,
                (int) $data['id_cliente'],
                true,
            );
            // Um pedido so por mesa: enquanto a comanda estiver aberta, cada nova rodada entra no
            // MESMO pedido (lockForUpdate evita dois celulares da mesa criarem dois pedidos juntos).
            // Pedido cancelado/finalizado pelo atendente nao recebe mais itens - ai abre outro.
            $pedido = Pedido::where('id_comanda', $comanda->id_comanda)
                ->whereNotIn('status', ['CANCELADO', 'FINALIZADO'])
                ->orderByDesc('id_pedido')
                ->lockForUpdate()
                ->first();

            $acrescimo = (bool) $pedido;

            if (!$pedido) {
                $pedido = Pedido::create([
                    'id_empresa' => $mesa->id_empresa,
                    'id_cliente' => $data['id_cliente'],
                    'id_mesa' => $mesa->id_mesa,
                    'id_comanda' => $comanda->id_comanda,
                    'codigo_qr' => (string) Str::uuid(),
                    'tipo_pedido' => 'MESA',
                    'canal_origem' => 'PRESENCIAL',
                    // O cliente ja esta fisicamente na mesa - nao faz sentido esperar um atendente
                    // clicar "enviar cozinha" manualmente. Entra direto na fila da cozinha (CONFIRMADO);
                    // quem decide quando comecar a preparar de fato e a propria cozinha.
                    'status' => 'CONFIRMADO',
                    'vl_total' => 0,
                    'vl_taxa_entrega' => 0,
                ]);

                // Forma real so se sabe no fechamento; PIX aqui e so placeholder (coluna nao aceita nulo).
                Pagamento::create([
                    'id_pedido' => $pedido->id_pedido,
                    'forma' => 'PIX',
                    'status' => 'PENDENTE',
                    'vl_total' => 0,
                    'vl_desconto' => 0,
                    'vl_final' => 0,
                ]);
            }

            foreach ($data['items'] as $index => $item) {
                $produto = $produtos->get($item['id_produto']);
                if (!$produto) {
                    continue;
                }
                foreach ($calculation['order_items_by_line'][$index] as $preco) {
                    ItemPedido::create([
                        'id_pedido' => $pedido->id_pedido,
                        'id_produto' => $produto->id_produto,
                        'nr_quantidade' => $preco['qty'],
                        'vl_preco_unitario' => $preco['unit_price'],
                        'vl_subtotal' => $preco['subtotal'],
                        'adicionais_json' => array_filter([
                            'observacao' => !empty($item['note']) ? mb_strtoupper(trim($item['note'])) : null,
                            // Quem da mesa pediu (o pedido e um so, mas cada rodada pode ser de alguem).
                            'cliente' => $nomeCliente,
                        ]) ?: null,
                    ]);
                }
            }

            $total = round((float) ItemPedido::where('id_pedido', $pedido->id_pedido)->sum('vl_subtotal'), 2);
            $pagamento = Pagamento::where('id_pedido', $pedido->id_pedido)->firstOrFail();
            $descontoAcumulado = round((float) $pagamento->vl_desconto + $calculation['discount'], 2);
            $atualizacao = ['vl_total' => $total];

            if ($acrescimo) {
                $atualizacao['dt_ultimo_acrescimo'] = now();
                $atualizacao['nr_acrescimos'] = $pedido->nr_acrescimos + 1;
                // Ja tinha saido da cozinha (pronto/servido): os itens novos precisam ser feitos,
                // entao o pedido volta pra fila. Em preparo continua em preparo.
                if (in_array($pedido->status, ['PRONTO', 'ENTREGANDO'], true)) {
                    $atualizacao['status'] = 'CONFIRMADO';
                }
            }

            $pedido->update($atualizacao);
            $pagamento->update([
                'vl_total' => round((float) $pagamento->vl_total + $calculation['original_subtotal'], 2),
                'vl_desconto' => $descontoAcumulado,
                'vl_final' => $total,
            ]);
            app(PromocaoService::class)->registrarUtilizacoes($calculation, $pedido, (int) $data['id_cliente']);

            return [$pedido, $calculation];
        });

        $comanda = $comanda->fresh(['pedidos.itens.produto', 'pedidos.cliente.usuario']);

        return response()->json([
            ...$this->comandaPayload($comanda),
            'id_cliente' => (int) $data['id_cliente'],
            'id_pedido' => $pedido->id_pedido,
            'pedido_total' => $calculation['subtotal'],
            'desconto_aplicado' => $calculation['discount'],
        ], 201);
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

        $comanda = $comanda->fresh(['pedidos.itens.produto', 'pedidos.cliente.usuario']);

        return response()->json($this->comandaPayload($comanda));
    }

    private function comandaPayload(Comanda $comanda): array
    {
        return [
            'id_comanda' => $comanda->id_comanda,
            'status' => $comanda->status,
            'forma_pagamento' => $comanda->forma_pagamento,
            'total' => $comanda->total,
            'dt_abertura' => optional($comanda->dt_cadastro)->format('Y-m-d H:i:s'),
            'consumo' => $comanda->resumoConsumo(),
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
