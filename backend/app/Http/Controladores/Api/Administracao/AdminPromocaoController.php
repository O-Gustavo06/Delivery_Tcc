<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use App\Models\Promocao;
use App\Models\Produto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminPromocaoController extends Controller
{
    private function empresaId(): int
    {
        return (int) DB::table('empresa')->orderBy('id_empresa')->value('id_empresa');
    }

    public function index(): JsonResponse
    {
        $promocoes = Promocao::with(['produtos:id_produto,nm_produto', 'categorias:id_categoria,nm_categoria'])
            ->where('id_empresa', $this->empresaId())
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $promocoes->map(fn (Promocao $promocao) => $this->payload($promocao))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request);
        $promocao = DB::transaction(function () use ($data) {
            $promocao = Promocao::create($this->attributes($data));
            $this->syncTargets($promocao, $data);

            return $promocao;
        });

        return response()->json(['data' => $this->payload($promocao->load(['produtos', 'categorias']))], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $promocao = Promocao::where('id_empresa', $this->empresaId())->findOrFail($id);
        $data = $this->validatePayload($request, $promocao);

        DB::transaction(function () use ($promocao, $data) {
            $promocao->update($this->attributes($data, $promocao));
            if (array_key_exists('produtos', $data) || array_key_exists('categorias', $data)) {
                $this->syncTargets($promocao, $data);
            }
        });

        $promocao->refresh()->load(['produtos', 'categorias']);
        return response()->json(['data' => $this->payload($promocao)]);
    }

    private function validatePayload(Request $request, ?Promocao $current = null): array
    {
        $isUpdate = $current !== null;
        $rules = [
            'tipo' => [$isUpdate ? 'sometimes' : 'required', Rule::in(['produto', 'cupom'])],
            'nome' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:120'],
            'codigo' => ['nullable', 'required_if:tipo,cupom', 'string', 'max:50'],
            'tipo_desconto' => [$isUpdate ? 'sometimes' : 'required', Rule::in(['percentual', 'fixo'])],
            'valor_desconto' => [$isUpdate ? 'sometimes' : 'required', 'numeric', 'gt:0', 'max:1000000'],
            'dt_fim' => [$isUpdate ? 'sometimes' : 'required', 'date', 'after:now'],
            'ativa' => ['sometimes', 'boolean'],
            'produtos' => [$isUpdate ? 'sometimes' : 'nullable', 'array'],
            'produtos.*' => ['integer', 'distinct'],
            'categorias' => [$isUpdate ? 'sometimes' : 'nullable', 'array'],
            'categorias.*' => ['integer', 'distinct'],
        ];
        if ($current) {
            $rules['codigo'][] = Rule::unique('promocao', 'codigo')
                ->where('id_empresa', $this->empresaId())
                ->ignore($current->id_promocao, 'id_promocao');
        } else {
            $rules['codigo'][] = Rule::unique('promocao', 'codigo')
                ->where('id_empresa', $this->empresaId());
        }

        $data = $request->validate($rules);
        $tipo = $data['tipo'] ?? $current?->tipo;
        $discountType = $data['tipo_desconto'] ?? $current?->tipo_desconto;
        $discountValue = $data['valor_desconto'] ?? $current?->valor_desconto;
        if ($discountType === 'percentual' && (float) $discountValue > 100) {
            throw ValidationException::withMessages([
                'valor_desconto' => ['O desconto percentual não pode ultrapassar 100%.'],
            ]);
        }
        if ($tipo === 'cupom' && trim((string) ($data['codigo'] ?? $current?->codigo)) === '') {
            throw ValidationException::withMessages([
                'codigo' => ['Informe o código do cupom.'],
            ]);
        }
        if ($current && ($data['ativa'] ?? false) && $current->dt_fim?->isPast()
            && !array_key_exists('dt_fim', $data)) {
            throw ValidationException::withMessages([
                'dt_fim' => ['Defina um novo prazo futuro para reativar esta campanha.'],
            ]);
        }

        $data['tipo'] = $tipo;
        if ($tipo === 'produto') {
            $data['codigo'] = null;
        } elseif (array_key_exists('codigo', $data)) {
            $data['codigo'] = mb_strtoupper(trim($data['codigo']));
        }

        $products = $data['produtos'] ?? $current?->produtos()->pluck('produto.id_produto')->all() ?? [];
        $categories = $data['categorias'] ?? $current?->categorias()->pluck('categoria.id_categoria')->all() ?? [];
        if (!$products && !$categories) {
            throw ValidationException::withMessages([
                'produtos' => ['Selecione ao menos um produto ou uma categoria.'],
            ]);
        }

        $companyId = $this->empresaId();
        if ($products && Produto::where('id_empresa', $companyId)->whereIn('id_produto', $products)->count() !== count(array_unique($products))) {
            throw ValidationException::withMessages([
                'produtos' => ['Um ou mais produtos não pertencem a este restaurante.'],
            ]);
        }
        if ($categories && Categoria::where('id_empresa', $companyId)->whereIn('id_categoria', $categories)->count() !== count(array_unique($categories))) {
            throw ValidationException::withMessages([
                'categorias' => ['Uma ou mais categorias não pertencem a este restaurante.'],
            ]);
        }

        return $data;
    }

    private function attributes(array $data, ?Promocao $current = null): array
    {
        $fields = [
            'tipo', 'nome', 'codigo', 'tipo_desconto', 'valor_desconto', 'dt_fim',
        ];
        $attributes = ['id_empresa' => $this->empresaId()];
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $attributes[$field] = $data[$field];
            }
        }
        if (!$current) {
            $attributes['dt_inicio'] = now();
        }
        if (array_key_exists('ativa', $data)) {
            $attributes['fl_ativa'] = $data['ativa'];
        } elseif (!$current) {
            $attributes['fl_ativa'] = true;
        }

        return $attributes;
    }

    private function syncTargets(Promocao $promocao, array $data): void
    {
        if (array_key_exists('produtos', $data)) {
            $promocao->produtos()->sync($data['produtos']);
        }
        if (array_key_exists('categorias', $data)) {
            $promocao->categorias()->sync($data['categorias']);
        }
    }

    private function payload(Promocao $promocao): array
    {
        return [
            'id' => (int) $promocao->id_promocao,
            'tipo' => $promocao->tipo,
            'nome' => $promocao->nome,
            'codigo' => $promocao->codigo,
            'tipo_desconto' => $promocao->tipo_desconto,
            'valor_desconto' => (float) $promocao->valor_desconto,
            'dt_fim' => $promocao->dt_fim?->toIso8601String(),
            'ativa' => (bool) $promocao->fl_ativa,
            'status' => !$promocao->fl_ativa
                ? 'inativa'
                : ($promocao->dt_fim?->isPast() ? 'expirada' : 'ativa'),
            'produtos' => $promocao->produtos->map(fn (Produto $produto) => [
                'id' => (int) $produto->id_produto,
                'nome' => $produto->nm_produto,
            ])->values(),
            'categorias' => $promocao->categorias->map(fn (Categoria $categoria) => [
                'id' => (int) $categoria->id_categoria,
                'nome' => $categoria->nm_categoria,
            ])->values(),
        ];
    }
}
