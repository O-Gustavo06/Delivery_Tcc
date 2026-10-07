<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Compra;
use App\Models\CompraItem;
use App\Models\EstoqueMovimento;
use App\Models\Ingrediente;
use App\Models\Pagamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminEstoqueController extends Controller
{
    /** Estoque igual ou abaixo disso entra como "baixo" na listagem. Fixo por enquanto. */
    private const LIMITE_ESTOQUE_BAIXO = 5;

    private function empresaId(): int
    {
        return (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');
    }

    public function listarIngredientes(): JsonResponse
    {
        $ingredientes = Ingrediente::where('id_empresa', $this->empresaId())
            ->orderBy('nm_ingrediente')
            ->get();

        return response()->json([
            'data' => $ingredientes->map(fn (Ingrediente $i) => $this->ingredienteToPayload($i))->values(),
        ]);
    }

    public function criarIngrediente(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nm_ingrediente' => ['required', 'string', 'max:150'],
            'unidade' => ['required', 'string', 'max:20'],
        ]);

        $ingrediente = Ingrediente::create([
            'id_empresa' => $this->empresaId(),
            'nm_ingrediente' => $data['nm_ingrediente'],
            'unidade' => $data['unidade'],
            'fl_ativo' => true,
            'qtd_atual' => 0,
        ]);

        return response()->json($this->ingredienteToPayload($ingrediente), 201);
    }

    /**
     * PATCH /admin/ingredientes/{id}
     * So edita o cadastro (nome/unidade) - a quantidade em estoque nunca e editada direto
     * aqui, sempre passa por um movimento (compra ou "Movimento avulso"), pra manter o
     * historico auditavel em estoque_movimento.
     */
    public function atualizarIngrediente(Request $request, string $id): JsonResponse
    {
        $ingrediente = Ingrediente::where('id_empresa', $this->empresaId())->find((int) $id);

        if (!$ingrediente) {
            return response()->json(['message' => 'Ingrediente nao encontrado.'], 404);
        }

        $data = $request->validate([
            'nm_ingrediente' => ['sometimes', 'string', 'max:150'],
            'unidade' => ['sometimes', 'string', 'max:20'],
        ]);

        $ingrediente->update($data);

        return response()->json($this->ingredienteToPayload($ingrediente->fresh()));
    }

    /**
     * POST /admin/estoque/movimento
     * Saida/ajuste avulso (quebra, perda, correcao) - nao ligado a compra nem a pedido.
     */
    public function registrarMovimentoAvulso(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id_ingrediente' => ['required', 'integer', 'exists:ingrediente,id_ingrediente'],
            'tipo' => ['required', 'string', 'in:ENTRADA,SAIDA,AJUSTE'],
            'qtde' => ['required', 'numeric', 'min:0.001'],
            'ds_motivo' => ['nullable', 'string', 'max:255'],
        ]);

        $ingrediente = Ingrediente::findOrFail($data['id_ingrediente']);

        if ($data['tipo'] !== 'ENTRADA' && (float) $ingrediente->qtd_atual < (float) $data['qtde']) {
            return response()->json([
                'message' => 'Quantidade maior que o estoque atual.',
                'errors' => ['qtde' => ['Nao ha estoque suficiente para essa saida.']],
            ], 422);
        }

        $movimento = DB::transaction(function () use ($data, $ingrediente) {
            $movimento = EstoqueMovimento::create([
                'id_ingrediente' => $ingrediente->id_ingrediente,
                'tipo' => $data['tipo'],
                'qtde' => $data['qtde'],
                'ds_motivo' => $data['ds_motivo'] ?? null,
            ]);

            if ($data['tipo'] === 'ENTRADA') {
                $ingrediente->increment('qtd_atual', $data['qtde']);
            } else {
                $ingrediente->decrement('qtd_atual', $data['qtde']);
            }

            return $movimento;
        });

        return response()->json([
            'movimento' => $movimento,
            'ingrediente' => $this->ingredienteToPayload($ingrediente->fresh()),
        ], 201);
    }

    public function listarCompras(Request $request): JsonResponse
    {
        $page = (int) $request->query('page', 1);
        $compras = Compra::with('itens.ingrediente')
            ->where('id_empresa', $this->empresaId())
            ->orderByDesc('dt_compra')
            ->paginate(20, ['*'], 'page', $page);

        return response()->json([
            'data' => $compras->getCollection()->map(fn (Compra $c) => $this->compraToPayload($c))->all(),
            'meta' => [
                'total' => $compras->total(),
                'per_page' => $compras->perPage(),
                'current_page' => $compras->currentPage(),
                'last_page' => $compras->lastPage(),
            ],
        ]);
    }

    public function mostrarCompra(string $id): JsonResponse
    {
        $compra = Compra::with('itens.ingrediente')->find((int) $id);

        if (!$compra) {
            return response()->json(['message' => 'Compra nao encontrada.'], 404);
        }

        return response()->json($this->compraToPayload($compra));
    }

    /**
     * POST /admin/compras
     * Registra a compra e, pra cada item, aumenta o estoque do ingrediente automaticamente
     * (compra_item + estoque_movimento ENTRADA + increment em ingrediente.qtd_atual), tudo
     * na mesma transacao.
     */
    public function registrarCompra(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ds_descricao' => ['nullable', 'string', 'max:255'],
            'nm_fornecedor' => ['nullable', 'string', 'max:150'],
            'dt_compra' => ['required', 'date'],
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.id_ingrediente' => ['required', 'integer', 'exists:ingrediente,id_ingrediente'],
            'itens.*.qtde' => ['required', 'numeric', 'min:0.001'],
            'itens.*.vl_unitario' => ['required', 'numeric', 'min:0'],
        ]);

        $compra = DB::transaction(function () use ($data) {
            $total = collect($data['itens'])->sum(fn (array $item) => $item['qtde'] * $item['vl_unitario']);

            $compra = Compra::create([
                'id_empresa' => $this->empresaId(),
                'id_usuario' => request()->user()->id_usuario,
                'ds_descricao' => $data['ds_descricao'] ?? null,
                'nm_fornecedor' => $data['nm_fornecedor'] ?? null,
                'vl_total' => round($total, 2),
                'dt_compra' => $data['dt_compra'],
            ]);

            foreach ($data['itens'] as $item) {
                $subtotal = round($item['qtde'] * $item['vl_unitario'], 2);

                CompraItem::create([
                    'id_compra' => $compra->id_compra,
                    'id_ingrediente' => $item['id_ingrediente'],
                    'qtde' => $item['qtde'],
                    'vl_unitario' => $item['vl_unitario'],
                    'vl_subtotal' => $subtotal,
                ]);

                EstoqueMovimento::create([
                    'id_ingrediente' => $item['id_ingrediente'],
                    'tipo' => 'ENTRADA',
                    'qtde' => $item['qtde'],
                    'custo_unitario' => $item['vl_unitario'],
                    'ds_motivo' => 'Compra #' . $compra->id_compra,
                ]);

                Ingrediente::whereKey($item['id_ingrediente'])->increment('qtd_atual', $item['qtde']);
            }

            return $compra->load('itens.ingrediente');
        });

        return response()->json($this->compraToPayload($compra), 201);
    }

    /**
     * GET /admin/financeiro/resumo?meses=6
     * Receita vem de pagamento (mesma fonte que o dashboard ja usa), custo vem das compras,
     * lucro e a diferenca. Devolve os ultimos N meses, mais antigo primeiro (bom pra grafico).
     */
    public function resumoFinanceiro(Request $request): JsonResponse
    {
        $meses = max(1, min(24, (int) $request->query('meses', 6)));
        $companyId = $this->empresaId();
        $inicio = now()->startOfMonth()->subMonths($meses - 1);

        $receitaPorMes = Pagamento::query()
            ->join('pedido', 'pedido.id_pedido', '=', 'pagamento.id_pedido')
            ->where('pedido.id_empresa', $companyId)
            ->where('pagamento.status', 'APROVADO')
            ->where('pagamento.dt_cadastro', '>=', $inicio)
            ->selectRaw("DATE_FORMAT(pagamento.dt_cadastro, '%Y-%m') as mes, SUM(pagamento.vl_final) as total")
            ->groupBy('mes')
            ->pluck('total', 'mes');

        $comprasPorMes = Compra::query()
            ->where('id_empresa', $companyId)
            ->where('dt_compra', '>=', $inicio)
            ->selectRaw("DATE_FORMAT(dt_compra, '%Y-%m') as mes, SUM(vl_total) as total")
            ->groupBy('mes')
            ->pluck('total', 'mes');

        $linhas = [];
        for ($i = $meses - 1; $i >= 0; $i--) {
            $chave = now()->startOfMonth()->subMonths($i)->format('Y-m');
            $receita = (float) ($receitaPorMes[$chave] ?? 0);
            $custo = (float) ($comprasPorMes[$chave] ?? 0);

            $linhas[] = [
                'mes' => $chave,
                'receita' => round($receita, 2),
                'custoCompras' => round($custo, 2),
                'lucro' => round($receita - $custo, 2),
            ];
        }

        $mesAtual = end($linhas);

        $topIngredientes = CompraItem::query()
            ->join('compra', 'compra.id_compra', '=', 'compra_item.id_compra')
            ->join('ingrediente', 'ingrediente.id_ingrediente', '=', 'compra_item.id_ingrediente')
            ->where('compra.id_empresa', $companyId)
            ->where('compra.dt_compra', '>=', $inicio)
            ->selectRaw('ingrediente.nm_ingrediente as nome, ingrediente.unidade as unidade, SUM(compra_item.qtde) as qtde, SUM(compra_item.vl_subtotal) as total')
            ->groupBy('ingrediente.id_ingrediente', 'ingrediente.nm_ingrediente', 'ingrediente.unidade')
            ->orderByDesc('total')
            ->limit(8)
            ->get();

        return response()->json([
            'kpis' => [
                ['id' => 'receita', 'label' => 'Receita do mes', 'value' => $this->money($mesAtual['receita']), 'tone' => 'success'],
                ['id' => 'custo', 'label' => 'Custo de compras do mes', 'value' => $this->money($mesAtual['custoCompras']), 'tone' => 'warning'],
                ['id' => 'lucro', 'label' => 'Lucro do mes', 'value' => $this->money($mesAtual['lucro']), 'tone' => $mesAtual['lucro'] >= 0 ? 'success' : 'sun'],
                ['id' => 'ingredientes_baixos', 'label' => 'Ingredientes em baixa', 'value' => (string) Ingrediente::where('id_empresa', $companyId)->where('qtd_atual', '<=', self::LIMITE_ESTOQUE_BAIXO)->count(), 'tone' => 'sun'],
            ],
            'meses' => $linhas,
            'topIngredientesComprados' => $topIngredientes->map(fn ($row) => [
                'nome' => $row->nome,
                'unidade' => $row->unidade,
                'qtde' => (float) $row->qtde,
                'total' => $this->money((float) $row->total),
            ])->values(),
        ]);
    }

    private function ingredienteToPayload(Ingrediente $ingrediente): array
    {
        return [
            'id' => $ingrediente->id_ingrediente,
            'name' => $ingrediente->nm_ingrediente,
            'unit' => $ingrediente->unidade,
            'qtdAtual' => (float) $ingrediente->qtd_atual,
            'isLow' => (float) $ingrediente->qtd_atual <= self::LIMITE_ESTOQUE_BAIXO,
            'active' => (bool) $ingrediente->fl_ativo,
        ];
    }

    private function compraToPayload(Compra $compra): array
    {
        return [
            'id' => $compra->id_compra,
            'descricao' => $compra->ds_descricao,
            'fornecedor' => $compra->nm_fornecedor,
            'total' => (float) $compra->vl_total,
            'data' => optional($compra->dt_compra)->format('Y-m-d H:i:s'),
            'itens' => $compra->itens->map(fn (CompraItem $item) => [
                'id' => $item->id_compra_item,
                'ingrediente' => $item->ingrediente?->nm_ingrediente ?? 'Ingrediente',
                'unidade' => $item->ingrediente?->unidade,
                'qtde' => (float) $item->qtde,
                'valorUnitario' => (float) $item->vl_unitario,
                'subtotal' => (float) $item->vl_subtotal,
            ])->values(),
        ];
    }

    private function money(float $value): string
    {
        return 'R$ ' . number_format($value, 2, ',', '.');
    }
}
