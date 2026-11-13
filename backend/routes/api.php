<?php

use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\AdminOrderController;
use App\Http\Controllers\Api\Admin\AuthController;
use App\Http\Controllers\Api\Admin\FechamentoCaixaController;
use App\Http\Controllers\Api\Admin\ComandaController;
use App\Http\Controllers\Api\Admin\EmpresaController;
use App\Http\Controllers\Api\Admin\AdminMesaController;
use App\Http\Controllers\Api\Admin\AdminEstoqueController;
use App\Http\Controllers\Api\Admin\AdminProdutoController;
use App\Http\Controllers\Api\Admin\AdminFiscalController;
use App\Http\Controllers\Api\Admin\AdminPromocaoController;
use App\Http\Controllers\Api\Admin\AdminWhatsAppController;
use App\Http\Controllers\Api\Admin\AdminGrowthController;
use App\Http\Controllers\Api\Motoboy\PedidoScanController;
use App\Http\Controllers\Api\Motoboy\EntregaController;
use App\Http\Controllers\Api\Motoboy\RotaController;
use App\Http\Controllers\Api\Motoboy\HistoricoController;
use App\Http\Controllers\Api\Mesa\MesaSessionController;
use App\Http\Controllers\Api\Delivery\PedidoOnlineController;
use App\Http\Controllers\Api\Presencial\PedidoPresencialController;
use App\Http\Controllers\Api\Webhook\AsaasWebhookController;
use App\Http\Controllers\Api\Webhook\EvolutionWebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('login-motoboy', [AuthController::class, 'loginMotoboy'])->middleware('throttle:5,1');
    Route::post('parear', [AuthController::class, 'parear'])->middleware('throttle:5,1');
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth.api');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth.api');
    Route::post('activity', [AuthController::class, 'activity'])->middleware('auth.api');
});

Route::prefix('admin')->middleware(['auth.api', 'role:admin,gerente,atendente'])->group(function () {
    Route::get('dashboard', [AdminDashboardController::class, 'index']);
    Route::get('orders', [AdminOrderController::class, 'index']);
    Route::post('orders', [AdminOrderController::class, 'store']);
    Route::get('orders/{orderId}', [AdminOrderController::class, 'show']);
    Route::patch('orders/{orderId}/status', [AdminOrderController::class, 'updateStatus']);
    Route::post('orders/{orderId}/send-to-kitchen', [AdminOrderController::class, 'sendToKitchen']);

    Route::get('motoboys/{entregadorId}/entregas', [FechamentoCaixaController::class, 'entregas']);

    Route::get('comandas/pendentes', [ComandaController::class, 'pendentes']);
    Route::post('comandas/{id}/confirmar-pagamento', [ComandaController::class, 'confirmarPagamento']);
    Route::post('comandas/{id}/cancelar', [ComandaController::class, 'cancelar']);

    Route::get('mesas/fila-espera', [AdminMesaController::class, 'listarFilaEspera']);
    Route::post('mesas/fila-espera', [AdminMesaController::class, 'adicionarNaFilaEspera']);
    Route::delete('mesas/fila-espera/{id}', [AdminMesaController::class, 'removerDaFilaEspera']);
    Route::get('mesas/inativas', [AdminMesaController::class, 'listarInativas']);
    Route::post('mesas', [AdminMesaController::class, 'criar']);
    Route::patch('mesas/{id}/desativar', [AdminMesaController::class, 'desativar']);
    Route::patch('mesas/{id}/reativar', [AdminMesaController::class, 'reativar']);
    Route::get('mesas/{id}', [AdminMesaController::class, 'show']);
    Route::post('mesas/{id}/liberar', [AdminMesaController::class, 'liberar']);

    Route::get('categorias', [AdminProdutoController::class, 'listarCategorias']);
    Route::get('produtos', [AdminProdutoController::class, 'listarProdutos']);

    Route::get('whatsapp/status', [AdminWhatsAppController::class, 'status']);
    Route::put('whatsapp/configuracoes-mensagens', [AdminWhatsAppController::class, 'atualizarConfiguracoesMensagens']);
    Route::post('whatsapp/instancia', [AdminWhatsAppController::class, 'criarInstancia']);
    Route::get('whatsapp/qrcode', [AdminWhatsAppController::class, 'qrcode']);
    Route::post('whatsapp/desconectar', [AdminWhatsAppController::class, 'desconectar']);
    Route::post('whatsapp/reconectar', [AdminWhatsAppController::class, 'reconectar']);
    Route::get('whatsapp/conversas', [AdminWhatsAppController::class, 'conversas']);
    Route::get('whatsapp/conversas/{telefone}/mensagens', [AdminWhatsAppController::class, 'mensagens']);
    Route::post('whatsapp/conversas/{telefone}/mensagens', [AdminWhatsAppController::class, 'enviarMensagem']);
});

Route::prefix('admin')->middleware(['auth.api', 'role:admin,gerente'])->group(function () {
    Route::get('growth', [AdminGrowthController::class, 'crescimento']);
    Route::get('customers', [AdminGrowthController::class, 'clientes']);
    Route::patch('customers/{id}', [AdminGrowthController::class, 'atualizarCliente']);
    Route::delete('customers/{id}', [AdminGrowthController::class, 'excluirCliente']);
    Route::get('customers/{id}/audit', [AdminGrowthController::class, 'auditoria']);
    Route::get('relatorios/export', [AdminDashboardController::class, 'exportarRelatorio']);
    Route::get('users', [AdminUserController::class, 'index']);
    Route::post('users/create', [AdminUserController::class, 'store']);
    Route::patch('users/{userId}', [AdminUserController::class, 'update']);
    Route::delete('users/{userId}', [AdminUserController::class, 'destroy']);
    Route::post('users/{userId}/gerar-codigo-pareamento', [AdminUserController::class, 'gerarCodigoPareamento']);

    Route::get('motoboys/fechamento', [FechamentoCaixaController::class, 'index']);
    Route::post('motoboys/{entregadorId}/fechamento/pagar', [FechamentoCaixaController::class, 'pagar']);

    Route::get('empresa', [EmpresaController::class, 'show']);
    Route::patch('empresa', [EmpresaController::class, 'update']);

    Route::get('ingredientes', [AdminEstoqueController::class, 'listarIngredientes']);
    Route::post('ingredientes', [AdminEstoqueController::class, 'criarIngrediente']);
    Route::patch('ingredientes/{id}', [AdminEstoqueController::class, 'atualizarIngrediente']);
    Route::post('estoque/movimento', [AdminEstoqueController::class, 'registrarMovimentoAvulso']);
    Route::get('estoque/previsao', [AdminEstoqueController::class, 'previsaoEstoque']);

    Route::get('compras', [AdminEstoqueController::class, 'listarCompras']);
    Route::post('compras', [AdminEstoqueController::class, 'registrarCompra']);
    Route::get('compras/{id}', [AdminEstoqueController::class, 'mostrarCompra']);

    Route::get('financeiro/resumo', [AdminEstoqueController::class, 'resumoFinanceiro']);
    Route::patch('financeiro/checklist', [AdminDashboardController::class, 'atualizarChecklist']);

    Route::post('categorias', [AdminProdutoController::class, 'criarCategoria']);
    Route::patch('categorias/{id}', [AdminProdutoController::class, 'atualizarCategoria']);

    Route::post('produtos', [AdminProdutoController::class, 'criarProduto']);
    Route::patch('produtos/{id}', [AdminProdutoController::class, 'atualizarProduto']);
    Route::delete('produtos/{id}', [AdminProdutoController::class, 'excluirProduto']);
    Route::get('produtos/{id}/receita', [AdminProdutoController::class, 'mostrarReceita']);
    Route::put('produtos/{id}/receita', [AdminProdutoController::class, 'salvarReceita']);
    Route::get('produtos/{id}/fiscal', [AdminFiscalController::class, 'produto']);
    Route::put('produtos/{id}/fiscal', [AdminFiscalController::class, 'salvarProduto']);

    Route::get('fiscal/configuracao', [AdminFiscalController::class, 'configuracao']);
    Route::put('fiscal/configuracao', [AdminFiscalController::class, 'salvarConfiguracao']);
    Route::get('fiscal/xml-editor', [AdminFiscalController::class, 'mostrarXmlEditor']);
    Route::put('fiscal/xml-editor', [AdminFiscalController::class, 'salvarXmlEditor']);
    Route::get('fiscal/documentos', [AdminFiscalController::class, 'listar']);
    Route::post('fiscal/documentos', [AdminFiscalController::class, 'criarRascunho']);
    Route::get('fiscal/documentos/{id}', [AdminFiscalController::class, 'mostrar']);
    Route::get('fiscal/documentos/{id}/xml-rascunho', [AdminFiscalController::class, 'mostrarXmlRascunho']);
    Route::post('fiscal/documentos/{id}/xml-rascunho/gerar', [AdminFiscalController::class, 'gerarXmlRascunho']);
    Route::put('fiscal/documentos/{id}/xml-rascunho', [AdminFiscalController::class, 'salvarXmlRascunho']);

    Route::get('promocoes', [AdminPromocaoController::class, 'index']);
    Route::post('promocoes', [AdminPromocaoController::class, 'store']);
    Route::patch('promocoes/{id}', [AdminPromocaoController::class, 'update']);

});

Route::prefix('mesa')->group(function () {
    Route::get('{token}', [MesaSessionController::class, 'show']);
    Route::post('{token}/ocupar', [MesaSessionController::class, 'ocupar']);
    Route::post('{token}/identificar', [MesaSessionController::class, 'identificar'])->middleware('throttle:10,1');
    Route::post('{token}/pedidos', [MesaSessionController::class, 'pedido'])->middleware('throttle:30,1');
    Route::post('{token}/fechar', [MesaSessionController::class, 'fechar']);
});

Route::prefix('pedir')->group(function () {
    Route::post('precificar', [PedidoOnlineController::class, 'precificar'])->middleware('throttle:30,1');
    Route::get('/', [PedidoOnlineController::class, 'cardapio']);
    Route::post('/', [PedidoOnlineController::class, 'store'])->middleware('throttle:5,1');
    Route::get('status/{codigoQr}', [PedidoOnlineController::class, 'status'])->middleware('throttle:60,1');
    Route::post('status/{codigoQr}/avaliacao', [PedidoOnlineController::class, 'avaliar'])->middleware('throttle:5,1');
    Route::post('status/{codigoQr}/push/inscrever', [PedidoOnlineController::class, 'inscreverPush'])->middleware('throttle:5,1');
});

Route::post('presencial/pedidos', [PedidoPresencialController::class, 'store']);

Route::post('asaas/webhook', [AsaasWebhookController::class, 'handle']);

Route::prefix('motoboy')->middleware(['auth.api', 'role:admin,gerente,atendente,entregador'])->group(function () {
    Route::get('pedidos/scan/{codigoQr}', [PedidoScanController::class, 'scan']);

    Route::get('rotas/ativa', [RotaController::class, 'ativa']);
    Route::patch('rotas/{rotaId}/reordenar', [RotaController::class, 'reordenar']);

    Route::patch('entregas/{entrega}/iniciar', [EntregaController::class, 'iniciar']);
    Route::patch('entregas/{entrega}/concluir', [EntregaController::class, 'concluir']);

    Route::get('entregas/historico', [HistoricoController::class, 'index']);
});

// Publica (sem auth.api) - a Evolution API nao tem como mandar Bearer token de usuario.
// Autenticada via campo "apikey" no corpo do payload (ver EvolutionWebhookController).
Route::post('webhooks/evolution', [EvolutionWebhookController::class, 'handle']);
