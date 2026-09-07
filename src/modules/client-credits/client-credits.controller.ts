import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { INTERNAL_USERS } from 'src/common/constants/role-groups.constant';
import type { Request } from 'express';
import { ClientCreditsService } from './client-credits.service';

@ApiTags('Créditos de Clientes')
@Controller('client-credits')
export class ClientCreditsController {
  constructor(private readonly clientCreditsService: ClientCreditsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({
    summary:
      'Retorna todos os créditos disponíveis e histórico do cliente autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de créditos retornada com sucesso',
  })
  async getMyCredits(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.clientCreditsService.getMyCredits(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('company/:companyId')
  @ApiOperation({
    summary:
      'Retorna o saldo de créditos do cliente autenticado em uma empresa específica',
  })
  @ApiParam({
    name: 'companyId',
    description: 'ID da empresa (UUID)',
    example: 'a6e7df4c-ad10-4259-9622-fe9a69eb51a5',
  })
  @ApiResponse({
    status: 200,
    description: 'Saldo de crédito retornado com sucesso',
  })
  async getCompanyCreditBalance(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.clientCreditsService.getCompanyCreditBalance(userId, companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('company/:companyId/owner')
  @ApiOperation({
    summary:
      'Retorna a lista de créditos de clientes emitidos por uma empresa (apenas para o dono)',
  })
  @ApiParam({
    name: 'companyId',
    description: 'ID da empresa (UUID)',
    example: 'a6e7df4c-ad10-4259-9622-fe9a69eb51a5',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de créditos da empresa retornada com sucesso',
  })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado para esta empresa',
  })
  async getCompanyCreditsForOwner(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.clientCreditsService.getCompanyCreditsForOwner(userId, companyId);
  }
}
