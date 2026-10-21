<?php

namespace Tests\Unit;

use App\Services\ClienteIdentityService;
use PHPUnit\Framework\TestCase;

class ClienteIdentityServiceTest extends TestCase
{
    public function test_normaliza_telefone_com_ddd_e_ddd_internacional(): void
    {
        $this->assertSame(
            '5511998887777',
            ClienteIdentityService::normalizarTelefone('(11) 99888-7777')
        );
        $this->assertSame(
            '5511998887777',
            ClienteIdentityService::normalizarTelefone('+55 11 99888-7777')
        );
    }

    public function test_nao_gera_identificador_para_telefone_incompleto(): void
    {
        $this->assertNull(ClienteIdentityService::normalizarTelefone('12345678'));
        $this->assertNull(ClienteIdentityService::normalizarTelefone(null));
    }
}
