<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    // DatabaseTransactions (nao RefreshDatabase): varias tabelas (pedido, usuario, cliente,
    // entregador, entrega, pagamento...) vem de SQL bruto, fora do historico de migrations do
    // Laravel (ver CLAUDE.md). RefreshDatabase tentaria migrate:fresh e apagaria essas tabelas
    // sem recria-las. O banco de teste (estudos_test) ja tem o schema completo importado uma vez;
    // cada teste roda dentro de uma transacao que da rollback no final.
    use DatabaseTransactions;
}
