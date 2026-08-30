<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Mesa\MesaSessionController;
use App\Http\Controllers\Controller;
use App\Models\Categoria;
use App\Models\Ingrediente;
use App\Models\Produto;
use App\Models\ProdutoIngrediente;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminProdutoController extends Controller
{
    private function empresaId(): int
    {
        return (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');
    }

    public function listarCategorias(): JsonResponse
    {
        $categorias = Categoria::where('id_empresa', $this->empresaId())
            ->orderBy('nr_ordem')
            ->orderBy('nm_categoria')
            ->get();

        return response()->json([
            'data' => $categorias->map(fn (Categoria $c) => [
                'id' => $c->id_categoria,
                'nome' => $c->nm_categoria,
                'ativa' => (bool) $c->fl_ativa,
            ])->values(),
        ]);
    }

    public function criarCategoria(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:100'],
        ]);

        $categoria = Categoria::create([
            'id_empresa' => $this->empresaId(),
            'nm_categoria' => $data['nome'],
            'fl_ativa' => true,
            'nr_ordem' => 0,
        ]);

        return response()->json([
            'id' => $categoria->id_categoria,
            'nome' => $categoria->nm_categoria,
            'ativa' => true,
        ], 201);
    }

    public function listarProdutos(Request $request): JsonResponse
    {
        $produtos = Produto::with('categoria')
            ->where('id_empresa', $this->empresaId())
            ->orderBy('nm_produto')
            ->get();

        return response()->json([
            'data' => $produtos->map(fn (Produto $p) => $this->produtoToPayload($request, $p))->values(),
        ]);
    }

    public function criarProduto(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:150'],
            'descricao' => ['nullable', 'string', 'max:1000'],
            'preco' => ['required', 'numeric', 'min:0'],
            'id_categoria' => ['required', 'integer', 'exists:categoria,id_categoria'],
            'tempo_preparo_min' => ['nullable', 'integer', 'min:0'],
            'imagem' => ['nullable', 'image', 'max:4096'],
        ]);

        $produto = Produto::create([
            'id_empresa' => $this->empresaId(),
            'id_categoria' => $data['id_categoria'],
            'nm_produto' => $data['nome'],
            'ds_produto' => $data['descricao'] ?? null,
            'vl_preco_base' => $data['preco'],
            'tempo_preparo_min' => $data['tempo_preparo_min'] ?? 15,
            'fl_ativo' => true,
            'url_imagem' => $this->salvarImagemProduto($request),
        ]);

        return response()->json($this->produtoToPayload($request, $produto->load('categoria')), 201);
    }

    public function atualizarProduto(Request $request, string $id): JsonResponse
    {
        $produto = Produto::where('id_empresa', $this->empresaId())->find((int) $id);

        if (!$produto) {
            return response()->json(['message' => 'Produto nao encontrado.'], 404);
        }

        $data = $request->validate([
            'nome' => ['sometimes', 'string', 'max:150'],
            'descricao' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'preco' => ['sometimes', 'numeric', 'min:0'],
            'id_categoria' => ['sometimes', 'integer', 'exists:categoria,id_categoria'],
            'tempo_preparo_min' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'url_imagem' => ['sometimes', 'nullable', 'string', 'max:500'],
            'imagem' => ['sometimes', 'nullable', 'image', 'max:4096'],
            'ativo' => ['sometimes', 'boolean'],
        ]);

        $map = [
            'nome' => 'nm_produto',
            'descricao' => 'ds_produto',
            'preco' => 'vl_preco_base',
            'id_categoria' => 'id_categoria',
            'tempo_preparo_min' => 'tempo_preparo_min',
            'url_imagem' => 'url_imagem',
            'ativo' => 'fl_ativo',
        ];

        foreach ($map as $front => $column) {
            if (array_key_exists($front, $data)) {
                $produto->{$column} = $data[$front];
            }
        }

        if ($request->hasFile('imagem')) {
            $this->apagarImagemProduto($produto->url_imagem);
            $produto->url_imagem = $this->salvarImagemProduto($request);
        }

        $produto->save();

        return response()->json($this->produtoToPayload($request, $produto->fresh('categoria')));
    }

    /**
     * DELETE /admin/produtos/{id}
     * Exclusao de verdade (nao e so desativar). So funciona se o produto nunca apareceu em
     * nenhum pedido - item_pedido.id_produto nao tem ON DELETE CASCADE de proposito, pra nao
     * apagar historico de vendas silenciosamente. Se ja foi pedido, devolve erro amigavel
     * sugerindo desativar em vez de excluir (mesmo padrao do AdminUserController::destroy).
     */
    public function excluirProduto(string $id): JsonResponse
    {
        $produto = Produto::where('id_empresa', $this->empresaId())->find((int) $id);

        if (!$produto) {
            return response()->json(['message' => 'Produto nao encontrado.'], 404);
        }

        try {
            $produto->delete();
        } catch (QueryException $e) {
            if ((int) $e->getCode() === 23000 || str_contains($e->getMessage(), '1451')) {
                return response()->json([
                    'message' => 'Nao e possivel excluir: esse produto ja tem pedidos vinculados. Desative-o em vez de excluir.',
                ], 409);
            }

            throw $e;
        }

        $this->apagarImagemProduto($produto->url_imagem);

        return response()->json(null, 204);
    }

    /**
     * Apaga o arquivo fisico da foto antiga do produto, se ela for um upload local (nunca
     * mexe em foto que seja uma URL externa). Usado tanto ao trocar a foto (PATCH) quanto ao
     * excluir o produto de vez (DELETE), pra nao acumular arquivo orfao em disco.
     */
    private function apagarImagemProduto(?string $urlImagem): void
    {
        if ($urlImagem && str_starts_with($urlImagem, '/images/produtos/')) {
            $caminho = public_path($urlImagem);
            if (is_file($caminho)) {
                @unlink($caminho);
            }
        }
    }

    /**
     * GET /admin/produtos/{id}/receita
     * Lista os ingredientes que compoem a receita (BOM) do produto, usados pra baixa
     * automatica de estoque quando o pedido e confirmado (ver AdminOrderController).
     */
    public function mostrarReceita(string $id): JsonResponse
    {
        $produto = Produto::where('id_empresa', $this->empresaId())->find((int) $id);

        if (!$produto) {
            return response()->json(['message' => 'Produto nao encontrado.'], 404);
        }

        $receita = ProdutoIngrediente::with('ingrediente')
            ->where('id_produto', $produto->id_produto)
            ->get();

        return response()->json([
            'data' => $receita->map(fn (ProdutoIngrediente $linha) => [
                'id_ingrediente' => $linha->id_ingrediente,
                'nome' => $linha->ingrediente?->nm_ingrediente ?? 'Ingrediente',
                'qtde' => (float) $linha->qtde,
                'unidade' => $linha->unidade,
            ])->values(),
        ]);
    }

    /**
     * PUT /admin/produtos/{id}/receita
     * Substitui a receita inteira do produto (sincroniza: apaga o que nao veio na lista,
     * atualiza o que mudou, cria o que e novo). Lista vazia = produto passa a nao baixar
     * estoque nenhum quando vendido.
     */
    public function salvarReceita(Request $request, string $id): JsonResponse
    {
        $produto = Produto::where('id_empresa', $this->empresaId())->find((int) $id);

        if (!$produto) {
            return response()->json(['message' => 'Produto nao encontrado.'], 404);
        }

        $data = $request->validate([
            'itens' => ['present', 'array'],
            'itens.*.id_ingrediente' => ['required', 'integer', 'exists:ingrediente,id_ingrediente', 'distinct'],
            'itens.*.qtde' => ['required', 'numeric', 'min:0.001'],
        ]);

        $ingredientes = Ingrediente::whereIn('id_ingrediente', collect($data['itens'])->pluck('id_ingrediente'))
            ->pluck('unidade', 'id_ingrediente');

        DB::transaction(function () use ($produto, $data, $ingredientes) {
            ProdutoIngrediente::where('id_produto', $produto->id_produto)->delete();

            foreach ($data['itens'] as $item) {
                ProdutoIngrediente::create([
                    'id_produto' => $produto->id_produto,
                    'id_ingrediente' => $item['id_ingrediente'],
                    'qtde' => $item['qtde'],
                    'unidade' => $ingredientes[$item['id_ingrediente']] ?? 'un',
                ]);
            }
        });

        return $this->mostrarReceita((string) $produto->id_produto);
    }

    /**
     * Salva a foto enviada em public/images/produtos (mesma pasta usada pelos produtos do
     * seeder) e devolve o caminho relativo pra guardar em produto.url_imagem - a URL completa
     * so e montada na hora de exibir (MesaSessionController::resolveImagemUrl), pra nao
     * hardcodar host/IP no banco.
     */
    private function salvarImagemProduto(Request $request): ?string
    {
        if (!$request->hasFile('imagem')) {
            return null;
        }

        $arquivo = $request->file('imagem');
        $nomeBase = Str::slug(pathinfo($arquivo->getClientOriginalName(), PATHINFO_FILENAME));
        $nomeArquivo = ($nomeBase ?: 'produto') . '-' . uniqid() . '.' . $arquivo->getClientOriginalExtension();

        $arquivo->move(public_path('images/produtos'), $nomeArquivo);

        return '/images/produtos/' . $nomeArquivo;
    }

    private function produtoToPayload(Request $request, Produto $produto): array
    {
        return [
            'id' => $produto->id_produto,
            'nome' => $produto->nm_produto,
            'descricao' => $produto->ds_produto,
            'preco' => (float) $produto->vl_preco_base,
            'tempoPreparoMin' => $produto->tempo_preparo_min,
            'urlImagem' => MesaSessionController::resolveImagemUrl($request, $produto->url_imagem),
            'ativo' => (bool) $produto->fl_ativo,
            'categoria' => [
                'id' => $produto->categoria?->id_categoria,
                'nome' => $produto->categoria?->nm_categoria ?? 'Sem categoria',
            ],
        ];
    }
}
