import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
