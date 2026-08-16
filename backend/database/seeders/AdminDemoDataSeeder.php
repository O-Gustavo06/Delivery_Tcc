<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminDemoDataSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $companyId = $this->ensureCompany();
            $categoryId = $this->ensureCategory($companyId);
            $productIds = $this->ensureProducts($companyId, $categoryId);
            $this->ensureAdminUser();
            $tableIds = $this->ensureTables($companyId);
            $customerIds = $this->ensureCustomers();
            $courierIds = $this->ensureCouriers();
            $this->ensureOrders($companyId, $customerIds, $tableIds, $productIds, $courierIds);
            $this->ensureSnapshots();
        });
    }

    private function ensureCompany(): int
    {
        $company = DB::table('empresa')->where('cnpj', '1234567890')->first();
        if ($company) {
            return (int) $company->id_empresa;
        }

        return (int) DB::table('empresa')->insertGetId([
            'nm_empresa' => 'Restaurante Modelo',
            'cnpj' => '1234567890',
            'config_taxas_km' => json_encode(['base' => 6.5]),
            'dt_cadastro' => now(),
            'dt_atualizacao' => now(),
        ]);
    }

    private function ensureCategory(int $companyId): int
    {
        $category = DB::table('categoria')
            ->where('id_empresa', $companyId)
            ->where('nm_categoria', 'Destaques')
            ->first();

        if ($category) {
            return (int) $category->id_categoria;
        }

        return (int) DB::table('categoria')->insertGetId([
            'id_empresa' => $companyId,
            'nm_categoria' => 'Destaques',
            'ds_categoria' => 'Itens principais do restaurante',
            'fl_ativa' => 1,
            'nr_ordem' => 1,
            'dt_cadastro' => now(),
        ]);
    }

    private function ensureProducts(int $companyId, int $categoryId): array
    {
        $catalog = [
            'Pizza Calabresa' => 39.90,
            'Refrigerante Lata' => 9.30,
            'Lanche X' => 18.00,
            'Batata Media' => 12.00,
            'Suco' => 12.00,
            'File de Frango' => 26.00,
            'Arroz Integral' => 16.00,
            'Hamburguer Artesanal' => 28.00,
            'Batata Frita' => 14.00,
        ];

        $ids = [];
        foreach ($catalog as $name => $price) {
            $product = DB::table('produto')
                ->where('id_empresa', $companyId)
                ->where('nm_produto', $name)
                ->first();

            if (!$product) {
                $productId = DB::table('produto')->insertGetId([
                    'id_empresa' => $companyId,
                    'id_categoria' => $categoryId,
                    'nm_produto' => $name,
                    'ds_produto' => $name,
                    'vl_preco_base' => $price,
                    'tempo_preparo_min' => 15,
                    'fl_ativo' => 1,
                    'url_imagem' => null,
                    'dt_cadastro' => now(),
                    'dt_atualizacao' => now(),
                ]);
            } else {
                $productId = $product->id_produto;
            }

            $ids[$name] = (int) $productId;
        }

        return $ids;
    }

    private function ensureAdminUser(): void
    {
        if (DB::table('usuario')->where('email', 'gustavolimadossantos643@gmail.com')->exists()) {
            return;
        }

        DB::table('usuario')->insert([
            'nm_usuario' => 'Administrador',
            'email' => 'gustavolimadossantos643@gmail.com',
            'senha_hash' => Hash::make('admin123'),
            'perfil' => 'ADMIN',
            'fl_ativo' => 1,
            'dt_cadastro' => now(),
            'dt_atualizacao' => now(),
        ]);
    }

    private function ensureTables(int $companyId): array
    {
        $definitions = [
            1 => 'OCUPADA',
            2 => 'RESERVADA',
            3 => 'LIVRE',
            4 => 'LIVRE',
            5 => 'OCUPADA',
            11 => 'OCUPADA',
            12 => 'OCUPADA',
            13 => 'LIVRE',
            14 => 'RESERVADA',
        ];

        $ids = [];
        foreach ($definitions as $number => $status) {
            $table = DB::table('mesa')
                ->where('id_empresa', $companyId)
                ->where('nr_mesa', $number)
                ->first();

            if (!$table) {
                $tableId = DB::table('mesa')->insertGetId([
                    'id_empresa' => $companyId,
                    'nr_mesa' => $number,
                    'status_ocupacao' => $status,
                    'qr_code_token' => 'mesa-' . $number,
                    'capacidade' => in_array($number, [3, 5], true) ? 6 : 4,
                    'dt_cadastro' => now(),
                ]);
            } else {
                $tableId = $table->id_mesa;
            }

            $ids[$number] = (int) $tableId;
        }

        return $ids;
    }

    private function ensureCustomers(): array
    {
        $definitions = [
            ['name' => 'Joao Silva', 'email' => 'joao.silva@example.com', 'telefone' => '11999990001', 'cpf' => '111.111.111-11'],
            ['name' => 'Carla Mendes', 'email' => 'carla.mendes@example.com', 'telefone' => '11999990002', 'cpf' => '222.222.222-22'],
            ['name' => 'Ana Paula', 'email' => 'ana.paula@example.com', 'telefone' => '11999990003', 'cpf' => '333.333.333-33'],
            ['name' => 'Mesa 12', 'email' => 'mesa12@example.com', 'telefone' => '11999990004', 'cpf' => '444.444.444-44'],
            ['name' => 'Mesa 5', 'email' => 'mesa5@example.com', 'telefone' => '11999990005', 'cpf' => '555.555.555-55'],
            ['name' => 'Carlos Lima', 'email' => 'carlos.lima@example.com', 'telefone' => '11999990006', 'cpf' => '666.666.666-66'],
        ];

        $ids = [];
        foreach ($definitions as $definition) {
            $user = DB::table('usuario')->where('email', $definition['email'])->first();
            if (!$user) {
                $userId = DB::table('usuario')->insertGetId([
                    'nm_usuario' => $definition['name'],
                    'email' => $definition['email'],
                    'senha_hash' => Hash::make('cliente123'),
                    'perfil' => 'CLIENTE',
                    'fl_ativo' => 1,
                    'dt_cadastro' => now(),
                    'dt_atualizacao' => now(),
                ]);
            } else {
                $userId = $user->id_usuario;
            }

            $client = DB::table('cliente')->where('id_usuario', $userId)->first();
            if (!$client) {
                $clientId = DB::table('cliente')->insertGetId([
                    'id_usuario' => $userId,
                    'telefone' => $definition['telefone'],
                    'cpf' => $definition['cpf'],
                    'dt_cadastro' => now(),
                ]);
            } else {
                $clientId = $client->id_cliente;
            }

            $ids[$definition['name']] = (int) $clientId;
        }

        return $ids;
    }

    private function ensureCouriers(): array
    {
        $definitions = [
            ['name' => 'Gabriel', 'email' => 'gabriel.courier@example.com', 'cpf' => '321.654.987-00', 'telefone' => '11999990007', 'online' => 1, 'veiculo' => 'Moto'],
            ['name' => 'Silas', 'email' => 'silas.courier@example.com', 'cpf' => '888.888.888-88', 'telefone' => '11999990008', 'online' => 1, 'veiculo' => 'Moto'],
            ['name' => 'Debora', 'email' => 'debora.courier@example.com', 'cpf' => '999.999.999-99', 'telefone' => '11999990009', 'online' => 0, 'veiculo' => 'Carro'],
        ];

        $ids = [];
        foreach ($definitions as $definition) {
            $user = DB::table('usuario')->where('email', $definition['email'])->first();
            if (!$user) {
                $userId = DB::table('usuario')->insertGetId([
                    'nm_usuario' => $definition['name'],
                    'email' => $definition['email'],
                    'senha_hash' => Hash::make('entrega123'),
                    'perfil' => 'ENTREGADOR',
                    'fl_ativo' => 1,
                    'dt_cadastro' => now(),
                    'dt_atualizacao' => now(),
                ]);
            } else {
                $userId = $user->id_usuario;
            }

            $courier = DB::table('entregador')->where('id_usuario', $userId)->first();
            if (!$courier) {
                $courierId = DB::table('entregador')->insertGetId([
                    'id_usuario' => $userId,
                    'cpf' => $definition['cpf'],
                    'telefone' => $definition['telefone'],
                    'fl_online' => $definition['online'],
                    'latitude' => null,
                    'longitude' => null,
                    'veiculo_tipo' => $definition['veiculo'],
                    'dt_ultima_localizacao' => now(),
                    'dt_cadastro' => now(),
                    'dt_atualizacao' => now(),
                ]);
            } else {
                $courierId = $courier->id_entregador;
            }

            $ids[$definition['name']] = (int) $courierId;
        }

        return $ids;
    }

    private function ensureOrders(int $companyId, array $customerIds, array $tableIds, array $productIds, array $courierIds): void
    {
        if (DB::table('pedido')->count() > 0) {
            return;
        }

        $orders = [
            [
                'number' => 1001,
                'customer' => 'Mesa 12',
                'table' => 12,
                'type' => 'MESA',
                'status' => 'PENDENTE',
                'total' => 58.50,
                'tax' => 0,
                'note' => 'Atendimento no salao',
                'items' => [
                    ['name' => 'Pizza Calabresa', 'qty' => 1, 'price' => 39.90],
                    ['name' => 'Refrigerante Lata', 'qty' => 2, 'price' => 9.30],
                ],
                'payment' => ['forma' => 'PIX', 'status' => 'APROVADO'],
                'delivery' => null,
                'created_at' => now()->subHours(6),
            ],
            [
                'number' => 1002,
                'customer' => 'Joao Silva',
                'table' => null,
                'type' => 'DELIVERY',
                'status' => 'CONFIRMADO',
                'total' => 72.00,
                'tax' => 8.00,
                'note' => 'Rua A, 123 - Centro',
                'items' => [
                    ['name' => 'Lanche X', 'qty' => 2, 'price' => 18.00],
                    ['name' => 'Batata Media', 'qty' => 1, 'price' => 12.00],
                    ['name' => 'Suco', 'qty' => 2, 'price' => 12.00],
                ],
                'payment' => ['forma' => 'CARTAO', 'status' => 'APROVADO'],
                'delivery' => ['courier' => 'Silas', 'status' => 'COLETADO', 'region' => 'Centro expandido', 'distance' => 6.2, 'eta' => 28],
                'created_at' => now()->subHours(5)->subMinutes(48),
            ],
            [
                'number' => 1003,
                'customer' => 'Mesa 5',
                'table' => 5,
                'type' => 'MESA',
                'status' => 'PREPARANDO',
                'total' => 42.00,
                'tax' => 0,
                'note' => 'Prioridade do chefe',
                'items' => [
                    ['name' => 'File de Frango', 'qty' => 1, 'price' => 26.00],
                    ['name' => 'Arroz Integral', 'qty' => 1, 'price' => 16.00],
                ],
                'payment' => ['forma' => 'DINHEIRO', 'status' => 'APROVADO'],
                'delivery' => null,
                'created_at' => now()->subHours(5)->subMinutes(39),
            ],
            [
                'number' => 1004,
                'customer' => 'Carlos Lima',
                'table' => null,
                'type' => 'DELIVERY',
                'status' => 'PRONTO',
                'total' => 98.00,
                'tax' => 10.00,
                'note' => 'Av. Paulista, 456 - Apto 12',
                'items' => [
                    ['name' => 'Hamburguer Artesanal', 'qty' => 2, 'price' => 28.00],
                    ['name' => 'Batata Frita', 'qty' => 1, 'price' => 14.00],
                    ['name' => 'Suco', 'qty' => 2, 'price' => 14.00],
                ],
                'payment' => ['forma' => 'PIX', 'status' => 'PENDENTE'],
                // Pedido de canal externo: codigo de confirmacao = ultimos 4 digitos do telefone
                // do cliente (Carlos Lima, '11999990006'), igual a regra usada em AdminOrderController.
                'channel' => 'IFOOD',
                'delivery' => ['courier' => 'Gabriel', 'status' => 'AGUARDANDO', 'region' => 'Jardim Europa', 'distance' => 4.1, 'eta' => 19, 'confirmation_code' => '0006'],
                'created_at' => now()->subHours(5)->subMinutes(25),
            ],
            [
                'number' => 1005,
                'customer' => 'Ana Paula',
                'table' => null,
                'type' => 'DELIVERY',
                'status' => 'ENTREGANDO',
                'total' => 64.00,
                'tax' => 7.00,
                'note' => 'Rua das Flores, 80 - Zona Norte',
                'items' => [
                    ['name' => 'Lanche X', 'qty' => 2, 'price' => 18.00],
                    ['name' => 'Batata Media', 'qty' => 1, 'price' => 12.00],
                    ['name' => 'Suco', 'qty' => 1, 'price' => 16.00],
                ],
                'payment' => ['forma' => 'CARTAO', 'status' => 'APROVADO'],
                'delivery' => ['courier' => 'Debora', 'status' => 'EM_ROTA', 'region' => 'Zona Norte', 'distance' => 8.9, 'eta' => 37],
                'created_at' => now()->subHours(4)->subMinutes(58),
            ],
            [
                'number' => 1006,
                'customer' => 'Carla Mendes',
                'table' => null,
                'type' => 'BALCAO',
                'status' => 'FINALIZADO',
                'total' => 31.00,
                'tax' => 0,
                'note' => 'Retirada no balcao',
                'items' => [
                    ['name' => 'Batata Media', 'qty' => 1, 'price' => 12.00],
                    ['name' => 'Suco', 'qty' => 1, 'price' => 19.00],
                ],
                'payment' => ['forma' => 'DINHEIRO', 'status' => 'APROVADO'],
                'delivery' => null,
                'created_at' => now()->subHours(4)->subMinutes(15),
            ],
        ];

        $nrPedidoDelivery = 0;

        foreach ($orders as $order) {
            $orderId = DB::table('pedido')->insertGetId([
                'id_empresa' => $companyId,
                'id_cliente' => $customerIds[$order['customer']],
                'id_mesa' => $order['table'] ? $tableIds[$order['table']] : null,
                'codigo_qr' => (string) Str::uuid(),
                'tipo_pedido' => $order['type'],
                'nr_pedido_delivery' => $order['type'] === 'DELIVERY' ? ++$nrPedidoDelivery : null,
                'canal_origem' => $order['channel'] ?? 'LOJA',
                'status' => $order['status'],
                'vl_total' => $order['total'],
                'vl_taxa_entrega' => $order['tax'],
                'ds_observacao' => $order['note'],
                'dt_pedido' => $order['created_at'],
                'dt_conclusao' => in_array($order['status'], ['FINALIZADO', 'CANCELADO'], true) ? now() : null,
                'dt_atualizacao' => now(),
            ]);

            foreach ($order['items'] as $item) {
                DB::table('item_pedido')->insert([
                    'id_pedido' => $orderId,
                    'id_produto' => $productIds[$item['name']],
                    'nr_quantidade' => $item['qty'],
                    'vl_preco_unitario' => $item['price'],
                    'vl_subtotal' => $item['qty'] * $item['price'],
                    'adicionais_json' => null,
                    'dt_cadastro' => now(),
                ]);
            }

            DB::table('pagamento')->insert([
                'id_pedido' => $orderId,
                'forma' => $order['payment']['forma'],
                'status' => $order['payment']['status'],
                'vl_total' => $order['total'],
                'vl_desconto' => 0,
                'vl_final' => $order['total'],
                'dt_cadastro' => now(),
                'dt_atualizacao' => now(),
            ]);

            if ($order['delivery']) {
                DB::table('entrega')->insert([
                    'id_pedido' => $orderId,
                    'id_entregador' => $courierIds[$order['delivery']['courier']],
                    'status_entrega' => $order['delivery']['status'],
                    'codigo_confirmacao_entrega' => $order['delivery']['confirmation_code'] ?? null,
                    'latitude_coleta' => null,
                    'longitude_coleta' => null,
                    'latitude_destino' => null,
                    'longitude_destino' => null,
                    'horario_saida' => in_array($order['delivery']['status'], ['COLETADO', 'EM_ROTA', 'ENTREGUE'], true) ? now()->subMinutes(20) : null,
                    'horario_chegada' => $order['delivery']['status'] === 'ENTREGUE' ? now()->subMinutes(5) : null,
                    'rota_json' => json_encode(['region' => $order['delivery']['region']]),
                    'distancia_km' => $order['delivery']['distance'],
                    'tempo_estimado_min' => $order['delivery']['eta'],
                    'dt_cadastro' => now(),
                    'dt_atualizacao' => now(),
                ]);
            }
        }
    }

    private function ensureSnapshots(): void
    {
        $snapshots = [
            'panel' => [
                'alerts' => [
                    ['id' => 'stock', 'tone' => 'warning', 'title' => 'Estoque critico', 'description' => 'Molho especial e embalagem G exigem reposicao ainda hoje.'],
                    ['id' => 'sla', 'tone' => 'info', 'title' => 'Entrega acima da meta', 'description' => 'Pedidos da Zona Norte exigem atencao na roteirizacao.'],
                    ['id' => 'team', 'tone' => 'success', 'title' => 'Equipe completa', 'description' => 'Todos os postos do turno atual estao preenchidos.'],
                ],
                'timeline' => [
                    ['time' => '10:20', 'title' => 'Caixa aberto', 'detail' => 'Turno da manha iniciado com conferencia completa.'],
                    ['time' => '11:05', 'title' => 'Pico de pedidos', 'detail' => 'Fila da cozinha chegou ao maior volume do turno.'],
                    ['time' => '12:40', 'title' => 'Sangria registrada', 'detail' => 'Retirada de caixa concluida pela gerencia.'],
                ],
            ],
            'kitchen' => [
                'stations' => [
                    ['id' => 'grill', 'name' => 'Chapa', 'leadTime' => '12 min', 'load' => 'Alta', 'team' => '2 cozinheiros'],
                    ['id' => 'pizza', 'name' => 'Forno', 'leadTime' => '18 min', 'load' => 'Media', 'team' => '1 pizzaiolo'],
                    ['id' => 'finish', 'name' => 'Finalizacao', 'leadTime' => '6 min', 'load' => 'Baixa', 'team' => '1 expedicao'],
                ],
                'prepList' => [
                    ['id' => 1, 'item' => 'Pizza Calabresa', 'pending' => 4, 'note' => '2 sem cebola'],
                    ['id' => 2, 'item' => 'Batata Media', 'pending' => 6, 'note' => 'Priorizar combos'],
                    ['id' => 3, 'item' => 'Molho da casa', 'pending' => 9, 'note' => 'Refazer cuba ate 19h'],
                ],
            ],
            'tables' => [
                'summary' => ['cleaning' => 1],
                'waitingList' => [
                    ['id' => 1, 'name' => 'Familia Costa', 'size' => 5, 'eta' => '8 min'],
                    ['id' => 2, 'name' => 'Bruna e amigos', 'size' => 4, 'eta' => '12 min'],
                ],
            ],
            'delivery' => [
                'incidents' => [
                    ['id' => 1, 'level' => 'warning', 'title' => 'Pedido em atraso', 'detail' => 'Cliente aguardando retorno do motoboy.'],
                    ['id' => 2, 'level' => 'danger', 'title' => 'Botao de apoio testado', 'detail' => 'Check de seguranca concluido por Debora.'],
                ],
            ],
            'finance' => [
                'checklist' => [
                    'Conferencia de abertura e suprimento de troco',
                    'Fechamento parcial do caixa por turno',
                    'Apuracao de comissao dos entregadores',
                    'Exportacao para emissao fiscal',
                ],
            ],
            'reports' => [
                'exports' => [
                    ['id' => 1, 'name' => 'Financeiro diario', 'schedule' => 'Todos os dias - 23:55', 'target' => 'Gestao e contador'],
                    ['id' => 2, 'name' => 'Fechamento semanal', 'schedule' => 'Domingos - 20:00', 'target' => 'Diretoria'],
                ],
            ],
            'customers' => [
                'campaigns' => [
                    'Cupom de recompra em 7 dias para novos clientes',
                    'Lembrete de aniversario com sobremesa cortesia',
                    'Lista de clientes inativos ha mais de 30 dias',
                ],
            ],
            'marketplace' => [
                'scorecards' => [
                    ['id' => 'online', 'label' => 'Loja online', 'value' => '99,2%', 'helper' => 'Disponibilidade nas ultimas 24h'],
                    ['id' => 'acceptance', 'label' => 'Aceitacao', 'value' => '97,8%', 'helper' => 'Pedidos aceitos sem atraso'],
                    ['id' => 'prep', 'label' => 'Preparo medio', 'value' => '18 min', 'helper' => 'Meta abaixo de 20 min'],
                ],
                'queues' => [
                    ['id' => 1, 'source' => 'iFood', 'total' => 3, 'status' => 'Ativo', 'note' => 'Pedidos sincronizados com sucesso'],
                    ['id' => 2, 'source' => 'Site proprio', 'total' => 2, 'status' => 'Ativo', 'note' => '1 pagamento pendente'],
                ],
                'actions' => [
                    'Atualizar cardapio promocional do jantar',
                    'Sincronizar estoque de bebidas com os apps',
                    'Revisar SLA de confirmacao em horarios de pico',
                ],
            ],
            'whatsapp' => [
                'inbox' => [
                    ['id' => 1, 'channel' => 'Novo pedido', 'total' => 12, 'tone' => 'success'],
                    ['id' => 2, 'channel' => 'Suporte', 'total' => 5, 'tone' => 'warning'],
                    ['id' => 3, 'channel' => 'Pos-venda', 'total' => 3, 'tone' => 'info'],
                ],
                'automations' => [
                    ['id' => 1, 'name' => 'Boas-vindas e cardapio', 'trigger' => 'Primeiro contato', 'status' => 'Ativo'],
                    ['id' => 2, 'name' => 'Pedido saiu para entrega', 'trigger' => 'Status saiu_entrega', 'status' => 'Ativo'],
                ],
                'campaigns' => [
                    ['id' => 1, 'title' => 'Combo do dia', 'audience' => 'Clientes ativos', 'sendAt' => '18:30'],
                    ['id' => 2, 'title' => 'Cupom volta logo', 'audience' => 'Inativos 30 dias', 'sendAt' => '11:00 amanha'],
                ],
            ],
        ];

        foreach ($snapshots as $slug => $payload) {
            DB::table('dashboard_snapshots')->updateOrInsert(
                ['slug' => $slug],
                [
                    'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }
    }
}
