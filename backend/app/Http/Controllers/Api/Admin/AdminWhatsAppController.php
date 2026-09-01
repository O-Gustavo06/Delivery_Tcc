<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Services\WhatsApp\EvolutionApiException;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Gerenciamento da instancia de WhatsApp (Evolution API) da empresa logada. So orquestra
 * requisicoes HTTP <-> WhatsAppService; nenhuma chamada a Evolution API acontece aqui direto.
 */
class AdminWhatsAppController extends Controller
{
    public function __construct(private readonly WhatsAppService $whatsApp)
    {
    }

    public function status(): JsonResponse
    {
        return $this->responder(fn () => $this->whatsApp->status($this->empresaAtual()));
    }

    public function criarInstancia(): JsonResponse
    {
        return $this->responder(fn () => $this->whatsApp->criarInstancia($this->empresaAtual()), 201);
    }

    public function qrcode(): JsonResponse
    {
        return $this->responder(fn () => $this->whatsApp->gerarQrCode($this->empresaAtual()));
    }

    public function desconectar(): JsonResponse
    {
        return $this->responder(fn () => $this->whatsApp->desconectar($this->empresaAtual()));
    }

    public function reconectar(): JsonResponse
    {
        return $this->responder(fn () => $this->whatsApp->reconectar($this->empresaAtual()));
    }

    public function conversas(): JsonResponse
    {
        return $this->responder(fn () => ['data' => $this->whatsApp->conversas($this->empresaAtual())]);
    }

    public function mensagens(string $telefone): JsonResponse
    {
        return $this->responder(fn () => ['data' => $this->whatsApp->mensagensDoTelefone($this->empresaAtual(), $telefone)]);
    }

    public function enviarMensagem(Request $request, string $telefone): JsonResponse
    {
        $dados = $request->validate(['mensagem' => ['required', 'string', 'max:4096']]);

        return $this->responder(
            fn () => ['data' => $this->whatsApp->enviarMensagemManual($this->empresaAtual(), $telefone, $dados['mensagem'])],
            201,
        );
    }

    private function empresaAtual(): Empresa
    {
        $empresa = Empresa::orderBy('id_empresa')->first();

        abort_if(!$empresa, 404, 'Nenhuma empresa cadastrada.');

        return $empresa;
    }

    private function responder(callable $acao, int $sucessoStatus = 200): JsonResponse
    {
        try {
            return response()->json($acao(), $sucessoStatus);
        } catch (EvolutionApiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Falha ao comunicar com o WhatsApp: ' . $e->getMessage()], 502);
        }
    }
}
