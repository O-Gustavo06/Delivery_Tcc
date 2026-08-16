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
        ];
    }
}
