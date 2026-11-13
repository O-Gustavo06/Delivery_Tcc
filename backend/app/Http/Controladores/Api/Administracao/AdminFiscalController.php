<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Compra;
use App\Models\DocumentoFiscal;
use App\Models\Empresa;
use App\Models\Pedido;
use App\Models\Produto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use DOMDocument;
use XMLWriter;

class AdminFiscalController extends Controller
{
    private function empresa(): Empresa
    {
        return Empresa::orderBy('id_empresa')->firstOrFail();
    }

    public function produto(string $id): JsonResponse
    {
        $produto = Produto::with('fiscal')->where('id_empresa', $this->empresa()->id_empresa)->findOrFail($id);

        return response()->json(['data' => $produto->fiscal]);
    }

    public function salvarProduto(Request $request, string $id): JsonResponse
    {
        $produto = Produto::where('id_empresa', $this->empresa()->id_empresa)->findOrFail($id);
        $data = $request->validate([
            'ncm' => ['nullable', 'string', 'regex:/^\d{8}$/'],
            'cest' => ['nullable', 'string', 'regex:/^\d{7}$/'],
            'cfop' => ['nullable', 'string', 'regex:/^\d{4}$/'],
            'cst_csosn' => ['nullable', 'string', 'regex:/^\d{2,3}$/'],
            'origem' => ['nullable', 'string', Rule::in(['0', '1', '2', '3', '4', '5', '6', '7', '8'])],
            'aliquota_icms' => ['nullable', 'numeric', 'between:0,100', 'decimal:0,4'],
            'aliquota_pis' => ['nullable', 'numeric', 'between:0,100', 'decimal:0,4'],
            'aliquota_cofins' => ['nullable', 'numeric', 'between:0,100', 'decimal:0,4'],
            'aliquota_ipi' => ['nullable', 'numeric', 'between:0,100', 'decimal:0,4'],
            'informacoes_adicionais' => ['nullable', 'string', 'max:5000'],
        ]);
        $produto->fiscal()->updateOrCreate([], $data);

        return $this->produto($id);
    }

    public function configuracao(): JsonResponse
    {
        $config = DB::table('empresa_fiscal')->where('id_empresa', $this->empresa()->id_empresa)->first();

        return response()->json(['data' => $config]);
    }

    public function salvarConfiguracao(Request $request): JsonResponse
    {
        $data = $request->validate([
            'regime' => ['nullable', Rule::in(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OUTRO'])],
            'uf' => ['nullable', Rule::in(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'])],
            'inscricao_estadual' => ['nullable', 'string', 'max:30'],
        ]);
        DB::table('empresa_fiscal')->updateOrInsert(
            ['id_empresa' => $this->empresa()->id_empresa],
            array_merge($data, ['dt_atualizacao' => now()])
        );

        return $this->configuracao();
    }

    public function listar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'direcao' => ['nullable', Rule::in(['ENTRADA', 'SAIDA'])],
            'status' => ['nullable', Rule::in(['RASCUNHO', 'AUTORIZADA', 'CANCELADA', 'REJEITADA'])],
        ]);
        $empresaId = $this->empresa()->id_empresa;
        $base = DocumentoFiscal::where('id_empresa', $empresaId);
        $contagens = (clone $base)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $query = clone $base;
        foreach (['direcao', 'status'] as $campo) {
            if (! empty($data[$campo])) {
                $query->where($campo, $data[$campo]);
            }
        }

        return response()->json([
            'resumo' => $contagens,
            'documentos' => $query->orderByDesc('id_documento_fiscal')->paginate(20),
            'emissao_disponivel' => false,
            'apuracao_disponivel' => false,
        ]);
    }

    public function mostrar(string $id): JsonResponse
    {
        $documento = DocumentoFiscal::where('id_empresa', $this->empresa()->id_empresa)->findOrFail($id);

        return response()->json(['data' => $documento]);
    }

    private function rascunhoNfce(string $id): DocumentoFiscal
    {
        return DocumentoFiscal::where('id_empresa', $this->empresa()->id_empresa)
            ->where('modelo', 'NFCE')->where('direcao', 'SAIDA')->where('status', 'RASCUNHO')
            ->findOrFail($id);
    }

    private function caminhoXmlRascunho(DocumentoFiscal $documento): string
    {
        return "fiscal/rascunhos/{$documento->id_empresa}/{$documento->id_documento_fiscal}.xml";
    }

    private function lerXml(string $caminho): JsonResponse
    {
        $storage = Storage::disk('local');
        if (! $storage->exists($caminho)) {
            return response()->json(['data' => null]);
        }
        $xml = $storage->get($caminho);
        if ($xml === null) {
            abort(500, 'Não foi possível ler o XML.');
        }

        return response()->json(['data' => $xml]);
    }

    private function caminhoXmlEditor(Request $request): string
    {
        $empresa = $this->empresa();
        $usuario = $request->user();

        return "fiscal/editor/{$empresa->id_empresa}/{$usuario->getKey()}.xml";
    }

    public function mostrarXmlEditor(Request $request): JsonResponse
    {
        return $this->lerXml($this->caminhoXmlEditor($request));
    }

    private function validarXml(Request $request): string
    {
        $data = $request->validate(['xml' => ['required', 'string', 'max:200000']]);
        $xml = $data['xml'];
        if (stripos($xml, '<!DOCTYPE') !== false) {
            throw ValidationException::withMessages(['xml' => 'Declarações DOCTYPE não são permitidas.']);
        }
        if (preg_match('/<\\?xml\\s[^?]*encoding\\s*=\\s*[\\x22\\x27]([^\\x22\\x27]+)[\\x22\\x27]/i', $xml, $matches)
            && strcasecmp($matches[1], 'UTF-8') !== 0) {
            throw ValidationException::withMessages(['xml' => 'O XML deve usar a codificação UTF-8.']);
        }
        $anterior = libxml_use_internal_errors(true);
        try {
            $dom = new DOMDocument;
            if (! $dom->loadXML($xml, LIBXML_NONET) || ! $dom->documentElement || $dom->doctype) {
                throw ValidationException::withMessages(['xml' => 'Informe um XML bem formado, sem DOCTYPE.']);
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($anterior);
        }
        return $xml;
    }

    public function salvarXmlEditor(Request $request): JsonResponse
    {
        $xml = $this->validarXml($request);
        if (! Storage::disk('local')->put($this->caminhoXmlEditor($request), $xml)) {
            abort(500, 'Não foi possível salvar o XML.');
        }

        return response()->json(['message' => 'XML salvo no editor.']);
    }

    public function mostrarXmlRascunho(string $id): JsonResponse
    {
        $documento = $this->rascunhoNfce($id);

        return $this->lerXml($this->caminhoXmlRascunho($documento));
    }

    public function gerarXmlRascunho(string $id): JsonResponse
    {
        $documento = $this->rascunhoNfce($id);
        $empresa = $this->empresa();
        $xml = new XMLWriter;
        $xml->openMemory();
        $xml->setIndent(true);
        $xml->startDocument('1.0', 'UTF-8');
        $xml->startElement('rascunhoNFCe');
        $xml->writeAttribute('status', 'NAO_AUTORIZADO');
        $xml->writeComment('Documento interno de preparação. Não é uma NFC-e e não possui validade fiscal.');
        $xml->writeElement('idDocumentoInterno', (string) $documento->id_documento_fiscal);
        if ($documento->id_pedido !== null) {
            $xml->writeElement('idPedido', (string) $documento->id_pedido);
        }
        $xml->startElement('emitente');
        foreach (['nome' => $empresa->nm_empresa, 'cnpj' => $empresa->cnpj] as $campo => $valor) {
            if ($valor !== null && $valor !== '') {
                $xml->writeElement($campo, (string) $valor);
            }
        }
        $xml->endElement();
        $xml->startElement('configuracaoFiscal');
        foreach (['regime', 'uf', 'inscricao_estadual'] as $campo) {
            $valor = $documento->contexto_fiscal[$campo] ?? null;
            if ($valor !== null && $valor !== '') {
                $xml->writeElement($campo, (string) $valor);
            }
        }
        $xml->endElement();
        $xml->startElement('itens');
        foreach ($documento->itens as $item) {
            $xml->startElement('item');
            foreach (['id_produto', 'nome', 'quantidade', 'valor_unitario', 'subtotal'] as $campo) {
                if (isset($item[$campo])) {
                    $xml->writeElement($campo, (string) $item[$campo]);
                }
            }
            if (! empty($item['referencia_fiscal'])) {
                $xml->startElement('referenciaFiscal');
                foreach (['ncm', 'cest', 'cfop', 'cst_csosn', 'origem', 'aliquota_icms', 'aliquota_pis', 'aliquota_cofins', 'aliquota_ipi', 'informacoes_adicionais'] as $campo) {
                    if (isset($item['referencia_fiscal'][$campo])) {
                        $xml->writeElement($campo, (string) $item['referencia_fiscal'][$campo]);
                    }
                }
                $xml->endElement();
            }
            $xml->endElement();
        }
        $xml->endElement();
        $xml->endElement();
        $xml->endDocument();

        return response()->json(['data' => $xml->outputMemory()]);
    }

    public function salvarXmlRascunho(Request $request, string $id): JsonResponse
    {
        $documento = $this->rascunhoNfce($id);
        $xml = $this->validarXml($request);
        if (! Storage::disk('local')->put($this->caminhoXmlRascunho($documento), $xml)) {
            abort(500, 'Não foi possível salvar o XML do rascunho.');
        }

        return response()->json(['message' => 'XML de rascunho salvo.']);
    }

    public function criarRascunho(Request $request): JsonResponse
    {
        $data = $request->validate([
            'modelo' => ['required', Rule::in(['NFE', 'NFCE'])],
            'direcao' => ['required', Rule::in(['ENTRADA', 'SAIDA'])],
            'id_pedido' => ['nullable', 'integer', 'min:1', 'prohibited_unless:direcao,SAIDA'],
            'id_compra' => ['nullable', 'integer', 'min:1', 'prohibited_unless:direcao,ENTRADA'],
        ]);
        $empresa = $this->empresa();
        $pedido = ! empty($data['id_pedido'])
            ? Pedido::with('itens.produto.fiscal')->where('id_empresa', $empresa->id_empresa)->findOrFail($data['id_pedido'])
            : null;
        $compra = ! empty($data['id_compra'])
            ? Compra::with('itens.ingrediente')->where('id_empresa', $empresa->id_empresa)->findOrFail($data['id_compra'])
            : null;
        $itens = $pedido
            ? $pedido->itens->map(fn ($item) => [
                'id_produto' => $item->id_produto,
                'nome' => $item->produto?->nm_produto,
                'quantidade' => $item->nr_quantidade,
                'valor_unitario' => $item->vl_preco_unitario,
                'subtotal' => $item->vl_subtotal,
                'referencia_fiscal' => $item->produto?->fiscal?->only([
                    'ncm', 'cest', 'cfop', 'cst_csosn', 'origem', 'aliquota_icms',
                    'aliquota_pis', 'aliquota_cofins', 'aliquota_ipi', 'informacoes_adicionais',
                ]),
            ])->all()
            : ($compra ? $compra->itens->map(fn ($item) => [
                'id_ingrediente' => $item->id_ingrediente,
                'nome' => $item->ingrediente?->nm_ingrediente,
                'quantidade' => $item->qtde,
                'valor_unitario' => $item->vl_unitario,
                'subtotal' => $item->vl_subtotal,
                'referencia_fiscal' => null,
            ])->all() : []);
        $config = DB::table('empresa_fiscal')->where('id_empresa', $empresa->id_empresa)
            ->first(['regime', 'uf', 'inscricao_estadual']);
        $documento = DocumentoFiscal::create([
            'id_empresa' => $empresa->id_empresa,
            'id_pedido' => $pedido?->id_pedido,
            'id_compra' => $compra?->id_compra,
            'modelo' => $data['modelo'],
            'direcao' => $data['direcao'],
            'status' => 'RASCUNHO',
            'contexto_fiscal' => $config ? (array) $config : [],
            'itens' => $itens,
        ]);

        return response()->json(['data' => $documento], 201);
    }
}
