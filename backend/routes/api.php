<?php

use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AdminOrderController;
use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth.api');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth.api');
});

Route::prefix('admin')->middleware(['auth.api', 'role:admin'])->group(function () {
    Route::get('users', [AdminUserController::class, 'index']);
    Route::post('users', [AdminUserController::class, 'store']);
    Route::patch('users/{userId}', [AdminUserController::class, 'update']);
    Route::delete('users/{userId}', [AdminUserController::class, 'destroy']);

    Route::get('orders', [AdminOrderController::class, 'index']);
    Route::post('orders', [AdminOrderController::class, 'store']);
    Route::get('orders/{orderId}', [AdminOrderController::class, 'show']);
    Route::patch('orders/{orderId}/status', [AdminOrderController::class, 'updateStatus']);
    Route::post('orders/{orderId}/send-to-kitchen', [AdminOrderController::class, 'sendToKitchen']);
});
