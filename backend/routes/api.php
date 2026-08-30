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
use App\Http\Controllers\Api\Admin\AdminWhatsAppController;
use App\Http\Controllers\Api\Motoboy\PedidoScanController;
use App\Http\Controllers\Api\Motoboy\EntregaController;
use App\Http\Controllers\Api\Motoboy\RotaController;
use App\Http\Controllers\Api\Motoboy\HistoricoController;
use App\Http\Controllers\Api\Mesa\MesaSessionController;
use App\Http\Controllers\Api\Delivery\PedidoOnlineController;
use App\Http\Controllers\Api\Webhook\EvolutionWebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('parear', [AuthController::class, 'parear']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth.api');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth.api');
});

Route::prefix('admin')->middleware(['auth.api', 'role:admin'])->group(function () {
    Route::get('dashboard', [AdminDashboardController::class, 'index']);
    Route::get('relatorios/export', [AdminDashboardController::class, 'exportarRelatorio']);
    Route::get('users', [AdminUserController::class, 'index']);
    Route::post('users/create', [AdminUserController::class, 'store']);
    Route::patch('users/{userId}', [AdminUserController::class, 'update']);
    Route::delete('users/{userId}', [AdminUserController::class, 'destroy']);
    Route::post('users/{userId}/gerar-codigo-pareamento', [AdminUserController::class, 'gerarCodigoPareamento']);

    Route::get('orders', [AdminOrderController::class, 'index']);
    Route::post('orders', [AdminOrderController::class, 'store']);
    Route::get('orders/{orderId}', [AdminOrderController::class, 'show']);
    Route::patch('orders/{orderId}/status', [AdminOrderController::class, 'updateStatus']);
    Route::post('orders/{orderId}/send-to-kitchen', [AdminOrderController::class, 'sendToKitchen']);

    Route::get('motoboys/fechamento', [FechamentoCaixaController::class, 'index']);
    Route::post('motoboys/{entregadorId}/fechamento/pagar', [FechamentoCaixaController::class, 'pagar']);
    Route::get('motoboys/{entregadorId}/entregas', [FechamentoCaixaController::class, 'entregas']);

    Route::get('comandas/pendentes', [ComandaController::class, 'pendentes']);
    Route::post('comandas/{id}/confirmar-pagamento', [ComandaController::class, 'confirmarPagamento']);
    Route::post('comandas/{id}/cancelar', [ComandaController::class, 'cancelar']);

    Route::get('mesas/fila-espera', [AdminMesaController::class, 'listarFilaEspera']);
    Route::post('mesas/fila-espera', [AdminMesaController::class, 'adicionarNaFilaEspera']);
    Route::delete('mesas/fila-espera/{id}', [AdminMesaController::class, 'removerDaFilaEspera']);
    Route::get('mesas/{id}', [AdminMesaController::class, 'show']);
    Route::post('mesas/{id}/liberar', [AdminMesaController::class, 'liberar']);

    Route::get('empresa', [EmpresaController::class, 'show']);
    Route::patch('empresa', [EmpresaController::class, 'update']);

    Route::get('ingredientes', [AdminEstoqueController::class, 'listarIngredientes']);
    Route::post('ingredientes', [AdminEstoqueController::class, 'criarIngrediente']);
    Route::patch('ingredientes/{id}', [AdminEstoqueController::class, 'atualizarIngrediente']);
    Route::post('estoque/movimento', [AdminEstoqueController::class, 'registrarMovimentoAvulso']);

    Route::get('compras', [AdminEstoqueController::class, 'listarCompras']);
    Route::post('compras', [AdminEstoqueController::class, 'registrarCompra']);
    Route::get('compras/{id}', [AdminEstoqueController::class, 'mostrarCompra']);

    Route::get('financeiro/resumo', [AdminEstoqueController::class, 'resumoFinanceiro']);
    Route::patch('financeiro/checklist', [AdminDashboardController::class, 'atualizarChecklist']);

    Route::get('categorias', [AdminProdutoController::class, 'listarCategorias']);
    Route::post('categorias', [AdminProdutoController::class, 'criarCategoria']);

    Route::get('produtos', [AdminProdutoController::class, 'listarProdutos']);
    Route::post('produtos', [AdminProdutoController::class, 'criarProduto']);
    Route::patch('produtos/{id}', [AdminProdutoController::class, 'atualizarProduto']);
    Route::delete('produtos/{id}', [AdminProdutoController::class, 'excluirProduto']);
    Route::get('produtos/{id}/receita', [AdminProdutoController::class, 'mostrarReceita']);
    Route::put('produtos/{id}/receita', [AdminProdutoController::class, 'salvarReceita']);

    Route::get('whatsapp/status', [AdminWhatsAppController::class, 'status']);
    Route::post('whatsapp/instancia', [AdminWhatsAppController::class, 'criarInstancia']);
    Route::get('whatsapp/qrcode', [AdminWhatsAppController::class, 'qrcode']);
    Route::post('whatsapp/desconectar', [AdminWhatsAppController::class, 'desconectar']);
    Route::post('whatsapp/reconectar', [AdminWhatsAppController::class, 'reconectar']);
    Route::get('whatsapp/conversas', [AdminWhatsAppController::class, 'conversas']);
});

Route::prefix('mesa')->group(function () {
    Route::get('{token}', [MesaSessionController::class, 'show']);
    Route::post('{token}/identificar', [MesaSessionController::class, 'identificar']);
    Route::post('{token}/pedidos', [MesaSessionController::class, 'pedido']);
    Route::post('{token}/fechar', [MesaSessionController::class, 'fechar']);
});

Route::prefix('pedir')->group(function () {
    Route::get('/', [PedidoOnlineController::class, 'cardapio']);
    Route::post('/', [PedidoOnlineController::class, 'store']);
    Route::get('status/{codigoQr}', [PedidoOnlineController::class, 'status']);
    Route::post('status/{codigoQr}/avaliacao', [PedidoOnlineController::class, 'avaliar']);
    Route::post('status/{codigoQr}/push/inscrever', [PedidoOnlineController::class, 'inscreverPush']);
    Route::get('cliente/{telefone}', [PedidoOnlineController::class, 'clientePorTelefone']);
});

Route::prefix('motoboy')->middleware(['auth.api', 'role:entregador'])->group(function () {
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
