<?php

use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\AdminOrderController;
use App\Http\Controllers\Api\Admin\AuthController;
use App\Http\Controllers\Api\Admin\FechamentoCaixaController;
use App\Http\Controllers\Api\Admin\ComandaController;
use App\Http\Controllers\Api\Admin\EmpresaController;
use App\Http\Controllers\Api\Admin\AdminMesaController;
use App\Http\Controllers\Api\Motoboy\PedidoScanController;
use App\Http\Controllers\Api\Motoboy\EntregaController;
use App\Http\Controllers\Api\Motoboy\RotaController;
use App\Http\Controllers\Api\Motoboy\HistoricoController;
use App\Http\Controllers\Api\Mesa\MesaSessionController;
use App\Http\Controllers\Api\Delivery\PedidoOnlineController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('parear', [AuthController::class, 'parear']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth.api');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth.api');
});

Route::prefix('admin')->middleware(['auth.api', 'role:admin'])->group(function () {
    Route::get('dashboard', [AdminDashboardController::class, 'index']);
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

    Route::get('mesas/{id}', [AdminMesaController::class, 'show']);

    Route::get('empresa', [EmpresaController::class, 'show']);
    Route::patch('empresa', [EmpresaController::class, 'update']);
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
