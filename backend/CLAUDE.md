# CLAUDE.md

Contexto do projeto para o Claude Code. Leia isto antes de mexer em qualquer código.

## Stack

- **Framework**: Laravel 12, PHP ^8.2
- **Auth**: Laravel Sanctum, via token Bearer (não usa cookies/sessão na API)
- **Banco**: MySQL
- **Front-end do painel**: separado (consome a API REST em `routes/api.php`)

## Convenções do projeto (IMPORTANTE — seguir sempre)

Este projeto **não usa os padrões default do Laravel**. Siga exatamente o que já existe:

- Tabelas em **português, snake_case, singular**: `pedido`, `entrega`, `entregador`, `pagamento`, `usuario` (não `users`, `orders`, etc.)
- Chaves primárias custom: `id_pedido`, `id_entrega`, `id_entregador`, `id_usuario` — nunca o `id` padrão do Laravel
- Timestamps custom: `dt_cadastro` / `dt_atualizacao` (via `const CREATED_AT` / `const UPDATED_AT` no model) em vez de `created_at`/`updated_at`. Alguns models não têm `dt_atualizacao` (ex: `RotaEntregaItem`, `FechamentoCaixaEntregador`) — nesse caso `const UPDATED_AT = null;`
- Colunas prefixadas por tipo: `vl_` (valor/decimal), `dt_` (data/timestamp), `fl_` (boolean/flag), `nm_` (nome), `ds_` (descrição/texto), `id_` (FK)
- Enums em MAIÚSCULO: `perfil` (`ADMIN`, `GERENTE`, `CLIENTE`, `ENTREGADOR`, `ATENDENTE`), `status_entrega` (`AGUARDANDO`, `COLETADO`, `EM_ROTA`, `ENTREGUE`, `CANCELADA`), `forma` de pagamento (`PIX`, `CARTAO`, `DINHEIRO`), `tipo_pedido` (`MESA`, `DELIVERY`, `BALCAO`)
- Models ficam em `App\Models`, controllers da API em `App\Http\Controllers\Api\...` (subpastas por área: `Api\Admin`, `Api\Motoboy`)
- Existem **duas tabelas de usuário**: `usuario` (a que o model `User` realmente usa, com `perfil`) e `users` (resquício do scaffold padrão do Laravel, tabela `role`, **não usada** — não desenvolver em cima dela, é dívida técnica pendente de limpeza)
- Middleware de auth: `auth.api` (valida token Sanctum) + `role:xxx` (`role:admin`, `role:entregador`, etc. — compara com `perfil` em minúsculo)

## Estrutura de dados relevante

| Tabela | Papel |
|---|---|
| `usuario` | Login de qualquer perfil (admin, gerente, cliente, entregador, atendente) |
| `pedido` | Pedido do cliente. `tipo_pedido = DELIVERY` é o que interessa pro módulo motoboy. Tem `codigo_qr` (único, gerado na impressão da comanda) |
| `entrega` | 1:1 com `pedido`. Guarda coordenadas, status, `rota_json`, `codigo_confirmacao_entrega` (validação iFood/99Food) |
| `entregador` | 1:1 com `usuario` (perfil ENTREGADOR). Tem `fl_online`, lat/long atual, `veiculo_tipo` |
| `pagamento` | 1:1 com `pedido`. `forma`, `vl_final`, `troco_para` (só se `forma = DINHEIRO`) |
| `rota_entrega` | Agrupamento de entregas por proximidade (rota inteligente). 1 entregador : N rotas |
| `rota_entrega_item` | N:N entre `rota_entrega` e `entrega`, com `ordem_sequencia` e `dt_entregue` |
| `fechamento_caixa_entregador` | Prestação de contas diária por entregador (taxas a receber, dinheiro recebido) |

## Módulo do Motoboy — o que estamos construindo

App/PWA separado para os entregadores fixos do estabelecimento. Fluxo: motoboy bipa o QR Code da comanda impressa → sistema atribui o pedido (ou a rota inteira, se houver outros pedidos agrupáveis no mesmo raio) → motoboy vê endereço, itens, forma de pagamento (com troco em destaque se for dinheiro) → inicia e conclui a entrega (com código de confirmação quando aplicável).

**Lógica de agrupamento** (`App\Services\RotaInteligenteService`):
1. Filtro grosso por raio via Haversine direto no banco (candidatos sem entregador ainda, `status_entrega = AGUARDANDO`)
2. Ordenação da sequência via Google Directions API (`waypoints=optimize:true`), com fallback local (nearest neighbor) se a API falhar ou a chave não estiver configurada

**Endpoints já planejados/implementados** (ver `routes/api.php`, grupo `motoboy` com middleware `auth.api` + `role:entregador`):
- `GET /motoboy/pedidos/scan/{codigoQr}` — bipar QR Code
- `GET /motoboy/rotas/ativa`, `PATCH /motoboy/rotas/{id}/reordenar`
- `PATCH /motoboy/entregas/{id}/iniciar`, `PATCH /motoboy/entregas/{id}/concluir`
- `GET /motoboy/entregas/historico?periodo=dia|geral`
- `GET /admin/motoboys/fechamento`, `POST /admin/motoboys/{id}/fechamento/pagar`

**Configuração necessária** em `.env` / `config/services.php`:
```
GOOGLE_MAPS_API_KEY=
EMPRESA_LAT=
EMPRESA_LNG=
```

## Como rodar localmente

```bash
composer install
cp .env.example .env   # se ainda não existir
php artisan key:generate
php artisan migrate
php artisan serve
```

Testar API:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'
```

## O que evitar

- Não criar novas tabelas/colunas em inglês ou fora do padrão de nomenclatura acima
- Não usar `$table->id()` padrão do Laravel sem customizar o nome da PK
- Não usar `created_at`/`updated_at` default — sempre `dt_cadastro`/`dt_atualizacao` (ou `null` quando não fizer sentido)
- Não desenvolver em cima da tabela `users` (Laravel default) — é a `usuario` que vale
- Antes de criar uma migration nova, rodar `php artisan migrate:status` pra confirmar o que já foi aplicado (algumas tabelas podem ter vindo de SQL direto, fora do histórico de migrations do Laravel)
