<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmpresaController extends Controller
{
    public function show(): JsonResponse
    {
        $empresa = Empresa::orderBy('id_empresa')->first();

        if (!$empresa) {
            return response()->json(['message' => 'Nenhuma empresa cadastrada.'], 404);
        }

        return response()->json($this->toPublic($empresa));
    }

    public function update(Request $request): JsonResponse
    {
        $empresa = Empresa::orderBy('id_empresa')->first();

        if (!$empresa) {
            return response()->json(['message' => 'Nenhuma empresa cadastrada.'], 404);
        }

        $data = $request->validate([
            'nm_empresa' => ['sometimes', 'string', 'max:200'],
            'chave_pix' => ['sometimes', 'nullable', 'string', 'max:150'],
            'fl_aberto' => ['sometimes', 'boolean'],
            'config_taxas_km' => ['sometimes', 'nullable', 'array'],
            'config_taxas_km.taxa_padrao' => ['sometimes', 'numeric', 'min:0'],
            'config_taxas_km.faixas' => ['sometimes', 'array'],
            'config_taxas_km.faixas.*.ate_km' => ['required_with:config_taxas_km.faixas', 'numeric', 'min:0.1'],
            'config_taxas_km.faixas.*.valor' => ['required_with:config_taxas_km.faixas', 'numeric', 'min:0'],
        ]);

        $empresa->update($data);

        return response()->json($this->toPublic($empresa->fresh()));
    }

    private function toPublic(Empresa $empresa): array
    {
        return [
            'id' => $empresa->id_empresa,
            'nome' => $empresa->nm_empresa,
            'chave_pix' => $empresa->chave_pix,
            'aberto' => (bool) $empresa->fl_aberto,
            'config_taxas_km' => $empresa->config_taxas_km,
        ];
    }
}
