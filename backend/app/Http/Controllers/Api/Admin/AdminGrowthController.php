<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Avaliacao;
use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\PosVenda;
use App\Models\WhatsappMensagem;
use App\Services\ClienteIdentityService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminGrowthController extends Controller
{
    public function crescimento(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inicio' => ['required', 'date_format:Y-m-d'],
            'fim' => ['required', 'date_format:Y-m-d', 'after_or_equal:inicio'],
        ]);

        $inicio = Carbon::parse($data['inicio'])->startOfDay();
        $fim = Carbon::parse($data['fim'])->endOfDay();
        $empresaId = (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');

        $pedidos = Pedido::query()
            ->where('id_empresa', $empresaId)
            ->where('status', 'FINALIZADO')
            ->whereBetween('dt_pedido', [$inicio, $fim]);

        $quantidadePedidos = (clone $pedidos)->count();
        $faturamento = (float) (clone $pedidos)->sum('vl_total');
        $clientesComCompra = (clone $pedidos)->whereNotNull('id_cliente')->distinct()->count('id_cliente');
        $repeticao = (clone $pedidos)
            ->select('id_cliente')
            ->whereNotNull('id_cliente')
            ->groupBy('id_cliente')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->count();

        $maisVendidos = DB::table('item_pedido')
            ->join('pedido', 'pedido.id_pedido', '=', 'item_pedido.id_pedido')
            ->join('produto', 'produto.id_produto', '=', 'item_pedido.id_produto')
            ->where('pedido.id_empresa', $empresaId)
            ->where('pedido.status', 'FINALIZADO')
            ->whereBetween('pedido.dt_pedido', [$inicio, $fim])
            ->select([
                'produto.id_produto as id',
                'produto.nm_produto as nome',
                DB::raw('SUM(item_pedido.nr_quantidade) as quantidade'),
                DB::raw('SUM(item_pedido.vl_subtotal) as faturamento'),
            ])
            ->groupBy('produto.id_produto', 'produto.nm_produto')
            ->orderByDesc('quantidade')
            ->limit(10)
            ->get()
            ->map(fn ($produto) => [
                'id' => (int) $produto->id,
                'nome' => $produto->nome,
                'quantidade' => (int) $produto->quantidade,
                'faturamento' => round((float) $produto->faturamento, 2),
            ]);

        $vendasPorDia = (clone $pedidos)
            ->selectRaw('DATE(dt_pedido) as data, COUNT(*) as pedidos, SUM(vl_total) as faturamento')
            ->groupByRaw('DATE(dt_pedido)')
            ->get()
            ->keyBy('data');
        $receitaPorDia = DB::table('pagamento')
            ->join('pedido', 'pedido.id_pedido', '=', 'pagamento.id_pedido')
            ->where('pedido.id_empresa', $empresaId)
            ->where('pagamento.status', 'APROVADO')
            ->whereBetween('pagamento.dt_cadastro', [$inicio, $fim])
            ->selectRaw('DATE(pagamento.dt_cadastro) as data, SUM(pagamento.vl_final) as receita')
            ->groupByRaw('DATE(pagamento.dt_cadastro)')
            ->pluck('receita', 'data');
        $comprasPorDia = DB::table('compra')
            ->where('id_empresa', $empresaId)
            ->whereBetween('dt_compra', [$inicio, $fim])
            ->selectRaw('DATE(dt_compra) as data, SUM(vl_total) as custo')
            ->groupByRaw('DATE(dt_compra)')
            ->pluck('custo', 'data');
        $produtosPorDia = DB::table('item_pedido')
            ->join('pedido', 'pedido.id_pedido', '=', 'item_pedido.id_pedido')
            ->join('produto', 'produto.id_produto', '=', 'item_pedido.id_produto')
            ->where('pedido.id_empresa', $empresaId)
            ->where('pedido.status', 'FINALIZADO')
            ->whereBetween('pedido.dt_pedido', [$inicio, $fim])
            ->selectRaw(
                'DATE(pedido.dt_pedido) as data, produto.id_produto as id, produto.nm_produto as nome, ' .
                'SUM(item_pedido.nr_quantidade) as quantidade, SUM(item_pedido.vl_subtotal) as faturamento'
            )
            ->groupByRaw('DATE(pedido.dt_pedido), produto.id_produto, produto.nm_produto')
            ->get()
            ->groupBy('data');
        $datasDoPeriodo = $vendasPorDia->keys()
            ->merge($receitaPorDia->keys())
            ->merge($comprasPorDia->keys())
            ->unique()
            ->sort()
            ->values();
        $vendasComLucroPorDia = $datasDoPeriodo->map(function ($data) use (
            $vendasPorDia,
            $receitaPorDia,
            $comprasPorDia,
            $produtosPorDia
        ) {
            $vendas = $vendasPorDia->get($data);
            $receita = (float) ($receitaPorDia[$data] ?? 0);
            $custo = (float) ($comprasPorDia[$data] ?? 0);

            return [
                'data' => $data,
                'pedidos' => (int) ($vendas->pedidos ?? 0),
                'faturamento' => round((float) ($vendas->faturamento ?? 0), 2),
                'receita' => round($receita, 2),
                'custo_compras' => round($custo, 2),
                'lucro' => round($receita - $custo, 2),
                'produtos' => $produtosPorDia->get($data, collect())->map(fn ($produto) => [
                    'id' => (int) $produto->id,
                    'nome' => $produto->nome,
                    'quantidade' => (int) $produto->quantidade,
                    'faturamento' => round((float) $produto->faturamento, 2),
                ])->values(),
            ];
        });

        $avaliacoesDePesquisa = PosVenda::query()
            ->where('status', 'RESPONDIDA')
            ->whereNotNull('nota')
            ->whereBetween('dt_resposta', [$inicio, $fim])
            ->get(['id_pedido', 'id_comanda', 'nota', 'dt_resposta']);

        $pedidosDaComanda = $avaliacoesDePesquisa->pluck('id_comanda')->filter()->isNotEmpty()
            ? Pedido::whereIn('id_comanda', $avaliacoesDePesquisa->pluck('id_comanda')->filter()->unique())
                ->pluck('id_pedido')
            : collect();
        $avaliacoesAntigas = Avaliacao::query()
            ->join('pedido', 'pedido.id_pedido', '=', 'avaliacao.id_pedido')
            ->where('pedido.id_empresa', $empresaId)
            ->where('pedido.status', 'FINALIZADO')
            ->whereBetween('avaliacao.dt_cadastro', [$inicio, $fim])
            ->when(
                $avaliacoesDePesquisa->pluck('id_pedido')->filter()->isNotEmpty() || $pedidosDaComanda->isNotEmpty(),
                fn ($query) => $query->whereNotIn(
                    'avaliacao.id_pedido',
                    $avaliacoesDePesquisa->pluck('id_pedido')->filter()->merge($pedidosDaComanda)->unique()
                )
            )
            ->get(['avaliacao.nota', 'avaliacao.dt_cadastro']);

        $notas = $avaliacoesDePesquisa->toBase()->map(fn ($avaliacao) => [
            'nota' => (int) $avaliacao->nota,
            'data' => $avaliacao->dt_resposta,
        ])->merge($avaliacoesAntigas->toBase()->map(fn ($avaliacao) => [
            'nota' => (int) $avaliacao->nota,
            'data' => $avaliacao->dt_cadastro,
        ]));

        $notasPorDia = $notas
            ->groupBy(fn ($avaliacao) => Carbon::parse($avaliacao['data'])->toDateString())
            ->map(fn ($avaliacoes, $dia) => [
                'data' => $dia,
                'media' => round($avaliacoes->avg('nota'), 2),
                'quantidade' => $avaliacoes->count(),
            ])
            ->values();

        $pedidosComPesquisa = $avaliacoesDePesquisa->pluck('id_pedido')->filter()
            ->merge($pedidosDaComanda)
            ->unique()
            ->values();
        $avaliacoesAntigasPorProduto = DB::table('avaliacao')
            ->join('pedido', 'pedido.id_pedido', '=', 'avaliacao.id_pedido')
            ->join('item_pedido', 'item_pedido.id_pedido', '=', 'pedido.id_pedido')
            ->join('produto', 'produto.id_produto', '=', 'item_pedido.id_produto')
            ->where('pedido.id_empresa', $empresaId)
            ->where('pedido.status', 'FINALIZADO')
            ->whereBetween('avaliacao.dt_cadastro', [$inicio, $fim])
            ->when($pedidosComPesquisa->isNotEmpty(), fn ($query) => $query->whereNotIn('pedido.id_pedido', $pedidosComPesquisa))
            ->selectRaw("produto.id_produto as id, produto.nm_produto as nome, avaliacao.nota, CONCAT('avaliacao:', avaliacao.id_avaliacao) as fonte");
        $avaliacoesPosVendaPorProduto = DB::table('pos_venda')
            ->join('pedido', function ($join) {
                $join->on('pedido.id_pedido', '=', 'pos_venda.id_pedido')
                    ->orOn('pedido.id_comanda', '=', 'pos_venda.id_comanda');
            })
            ->join('item_pedido', 'item_pedido.id_pedido', '=', 'pedido.id_pedido')
            ->join('produto', 'produto.id_produto', '=', 'item_pedido.id_produto')
            ->where('pedido.id_empresa', $empresaId)
            ->where('pedido.status', 'FINALIZADO')
            ->where('pos_venda.status', 'RESPONDIDA')
            ->whereNotNull('pos_venda.nota')
            ->whereBetween('pos_venda.dt_resposta', [$inicio, $fim])
            ->selectRaw("DISTINCT produto.id_produto as id, produto.nm_produto as nome, pos_venda.nota, CONCAT('pos-venda:', pos_venda.id_pos_venda) as fonte");
        $avaliacoesPorProduto = DB::query()
            ->fromSub($avaliacoesAntigasPorProduto->unionAll($avaliacoesPosVendaPorProduto), 'avaliacoes_produto')
            ->select([
                'id',
                'nome',
                DB::raw('AVG(nota) as media'),
                DB::raw('COUNT(DISTINCT fonte) as avaliacoes'),
            ])
            ->groupBy('id', 'nome')
            ->orderByDesc('media')
            ->orderByDesc('avaliacoes')
            ->limit(10)
            ->get()
            ->map(fn ($produto) => [
                'id' => (int) $produto->id,
                'nome' => $produto->nome,
                'media' => round((float) $produto->media, 2),
                'avaliacoes' => (int) $produto->avaliacoes,
            ]);

        $pesquisasNegativas = PosVenda::with('cliente.usuario')
            ->where('status', 'RESPONDIDA')
            ->whereNotNull('nota')
            ->where('nota', '<=', 2)
            ->whereBetween('dt_resposta', [$inicio, $fim])
            ->get()
            ->toBase()
            ->map(fn (PosVenda $pesquisa) => [
                'cliente' => $pesquisa->cliente?->usuario?->nm_usuario ?? 'Cliente',
                'referencia' => $pesquisa->id_pedido ? 'Pedido #' . $pesquisa->id_pedido : 'Comanda #' . $pesquisa->id_comanda,
                'nota' => (int) $pesquisa->nota,
                'comentario' => $pesquisa->ds_comentario,
                'data' => $pesquisa->dt_resposta,
            ]);
        $avaliacoesNegativas = Avaliacao::with(['cliente.usuario', 'pedido'])
            ->where('nota', '<=', 2)
            ->whereBetween('dt_cadastro', [$inicio, $fim])
            ->whereHas('pedido', fn ($query) => $query
                ->where('id_empresa', $empresaId)
                ->where('status', 'FINALIZADO'))
            ->when($pedidosComPesquisa->isNotEmpty(), fn ($query) => $query->whereNotIn('id_pedido', $pedidosComPesquisa))
            ->get()
            ->toBase()
            ->map(fn (Avaliacao $avaliacao) => [
                'cliente' => $avaliacao->cliente?->usuario?->nm_usuario ?? 'Cliente',
                'referencia' => 'Pedido #' . $avaliacao->id_pedido,
                'nota' => (int) $avaliacao->nota,
                'comentario' => $avaliacao->ds_comentario,
                'data' => $avaliacao->dt_cadastro,
            ]);
        $feedbackNegativo = $pesquisasNegativas
            ->merge($avaliacoesNegativas)
            ->sortByDesc('data')
            ->take(10)
            ->values();

        return response()->json([
            'periodo' => ['inicio' => $inicio->toDateString(), 'fim' => $fim->toDateString()],
            'indicadores' => [
                'pedidos' => $quantidadePedidos,
                'faturamento' => round($faturamento, 2),
                'ticket_medio' => $quantidadePedidos ? round($faturamento / $quantidadePedidos, 2) : 0,
                'clientes' => $clientesComCompra,
                'recorrentes' => $repeticao,
                'taxa_recorrencia' => $clientesComCompra ? round(($repeticao / $clientesComCompra) * 100, 1) : 0,
                'nota_media' => $notas->isNotEmpty() ? round($notas->avg('nota'), 2) : null,
                'avaliacoes' => $notas->count(),
            ],
            'mais_vendidos' => $maisVendidos,
            'mais_bem_avaliados' => $avaliacoesPorProduto,
            'feedback_negativo' => $feedbackNegativo,
            'vendas_por_dia' => $vendasComLucroPorDia,
            'satisfacao_por_dia' => $notasPorDia,
        ]);
    }

    public function clientes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'busca' => ['nullable', 'string', 'max:150'],
            'por_pagina' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $busca = trim($data['busca'] ?? '');
        $clientes = Cliente::query()
            ->with('usuario')
            ->whereNull('id_cliente_principal')
            ->withCount(['pedidos' => fn ($query) => $query->where('status', 'FINALIZADO')])
            ->withMax(['pedidos as ultimo_pedido' => fn ($query) => $query->where('status', 'FINALIZADO')], 'dt_pedido')
            ->when($busca !== '', function ($query) use ($busca) {
                $query->where(function ($filtro) use ($busca) {
                    $filtro->whereHas('usuario', fn ($usuario) => $usuario->where('nm_usuario', 'like', '%' . $busca . '%'))
                        ->orWhere('telefone', 'like', '%' . $busca . '%')
                        ->orWhere('telefone_normalizado', 'like', '%' . preg_replace('/\D+/', '', $busca) . '%');
                });
            })
            ->orderByDesc('pedidos_count')
            ->orderBy('id_cliente')
            ->paginate((int) ($data['por_pagina'] ?? 25));

        $clientes->getCollection()->transform(fn (Cliente $cliente) => [
            'id' => $cliente->id_cliente,
            'nome' => $cliente->usuario?->nm_usuario ?? 'Cliente',
            'telefone' => $cliente->telefone,
            'telefone_normalizado' => $cliente->telefone_normalizado,
            'pedidos' => (int) $cliente->pedidos_count,
            'ultimo_pedido' => $cliente->ultimo_pedido,
        ]);

        return response()->json($clientes);
    }

    public function auditoria(string $id): JsonResponse
    {
        $cliente = app(ClienteIdentityService::class)->resolverPorId((int) $id);
        if (!$cliente) {
            return response()->json(['message' => 'Cliente nao encontrado.'], 404);
        }

        $pedidos = Pedido::with(['itens.produto', 'avaliacao', 'pagamento', 'entrega'])
            ->where('id_cliente', $cliente->id_cliente)
            ->orderByDesc('dt_pedido')
            ->get();
        $pedidosConcluidos = $pedidos->where('status', 'FINALIZADO');
        $datasDeCompra = $pedidosConcluidos->pluck('dt_pedido')->sort()->values();
        $intervalos = $datasDeCompra->slice(1)->map(
            fn ($data, $index) => Carbon::parse($datasDeCompra[$index - 1])->diffInDays(Carbon::parse($data))
        );

        $produtos = DB::table('item_pedido')
            ->join('pedido', 'pedido.id_pedido', '=', 'item_pedido.id_pedido')
            ->join('produto', 'produto.id_produto', '=', 'item_pedido.id_produto')
            ->where('pedido.id_cliente', $cliente->id_cliente)
            ->where('pedido.status', 'FINALIZADO')
            ->select([
                'produto.id_produto as id',
                'produto.nm_produto as nome',
                DB::raw('SUM(item_pedido.nr_quantidade) as quantidade'),
            ])
            ->groupBy('produto.id_produto', 'produto.nm_produto')
            ->orderByDesc('quantidade')
            ->limit(10)
            ->get();

        $pesquisas = PosVenda::with(['pedido', 'comanda'])
            ->where('id_cliente', $cliente->id_cliente)
            ->orderByDesc('created_at')
            ->get();
        $mensagens = WhatsappMensagem::with('posVenda')
            ->where('id_cliente', $cliente->id_cliente)
            ->orderByDesc('dt_mensagem')
            ->limit(100)
            ->get();

        return response()->json([
            'cliente' => [
                'id' => $cliente->id_cliente,
                'nome' => $cliente->usuario?->nm_usuario ?? 'Cliente',
                'telefone' => $cliente->telefone,
                'telefone_normalizado' => $cliente->telefone_normalizado,
                'cadastro' => $cliente->dt_cadastro,
            ],
            'indicadores' => [
                'pedidos' => $pedidosConcluidos->count(),
                'frequencia_media_dias' => $intervalos->isNotEmpty() ? round($intervalos->avg(), 1) : null,
                'ultimo_pedido' => $pedidosConcluidos->first()?->dt_pedido,
            ],
            'produtos_favoritos' => $produtos,
            'pedidos' => $pedidos->take(100)->map(fn (Pedido $pedido) => [
                'id' => $pedido->id_pedido,
                'data' => $pedido->dt_pedido,
                'status' => $pedido->status,
                'canal' => $pedido->canal_origem,
                'tipo' => $pedido->tipo_pedido,
                'total' => (float) $pedido->vl_total,
                'itens' => $pedido->itens->map(fn ($item) => [
                    'produto' => $item->produto?->nm_produto ?? 'Produto removido',
                    'quantidade' => (int) $item->nr_quantidade,
                    'subtotal' => (float) $item->vl_subtotal,
                ])->values(),
                'avaliacao' => $pedido->avaliacao ? [
                    'nota' => (int) $pedido->avaliacao->nota,
                    'comentario' => $pedido->avaliacao->ds_comentario,
                    'data' => $pedido->avaliacao->dt_cadastro,
                ] : null,
            ])->values(),
            'pos_venda' => $pesquisas->map(fn (PosVenda $pesquisa) => [
                'id' => $pesquisa->id_pos_venda,
                'pedido' => $pesquisa->id_pedido,
                'comanda' => $pesquisa->id_comanda,
                'status' => $pesquisa->status,
                'nota' => $pesquisa->nota,
                'comentario' => $pesquisa->ds_comentario,
                'enviado_em' => $pesquisa->dt_enviado,
                'respondido_em' => $pesquisa->dt_resposta,
            ])->values(),
            'mensagens' => $mensagens->map(fn (WhatsappMensagem $mensagem) => [
                'id' => $mensagem->id_whatsapp_mensagem,
                'conteudo' => $mensagem->conteudo,
                'direcao' => $mensagem->direcao,
                'status' => $mensagem->status_envio,
                'data' => $mensagem->dt_mensagem,
                'pos_venda' => $mensagem->id_pos_venda,
            ])->values(),
        ]);
    }
}
