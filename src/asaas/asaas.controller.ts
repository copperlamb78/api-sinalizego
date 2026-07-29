import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AsaasService } from './asaas.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/roles/guard/roles.guard';
import { Roles } from 'src/modules/auth/roles/decorators/roles.decorator';
import { SYSTEM_MANAGERS } from 'src/common/constants/role-groups.constant';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('Asaas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SYSTEM_MANAGERS)
@Controller('asaas')
export class AsaasController {
  constructor(private readonly asaasService: AsaasService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Lista todas as subcontas cadastradas no Asaas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de subcontas retornada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação ou erro retornado pelo Asaas',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async listAccounts() {
    return this.asaasService.listAllSubAccounts();
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @ApiOperation({ summary: 'Retorna uma subconta específica pelo ID no Asaas' })
  @ApiResponse({
    status: 200,
    description: 'Subconta retornada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação ou erro retornado pelo Asaas',
  })
  @ApiResponse({ status: 404, description: 'Subconta não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAccountById(id: string) {
    return this.asaasService.listSubAccountById(id);
  }

  //crie a rota de receber balance da subconta
  @Get('balance/:walletId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @ApiOperation({
    summary: 'Busca o saldo de uma subconta Asaas pelo ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Saldo da subconta retornado com sucesso',
    schema: {
      example: {
        balance: 1234.56,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação ou erro retornado pelo Asaas',
  })
  @ApiResponse({ status: 404, description: 'Subconta não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getSubaccountBalance(
    @Param('walletId') walletId: string,
    @Param('userId') userId: string,
  ) {
    return this.asaasService.getSubacccountBalance(walletId, userId);
  }
}
