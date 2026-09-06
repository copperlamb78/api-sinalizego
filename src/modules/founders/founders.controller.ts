import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { INTERNAL_NO_EMPLOYEE } from '../../common/constants/role-groups.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { CreateFounderDto } from './dto/create-founder.dto';
import { FoundersService } from './founders.service';

@ApiTags('Fundadores')
@Controller()
export class FoundersController {
  constructor(
    private readonly foundersService: FoundersService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyIdFromUserId(userId: string): Promise<string> {
    const company = await this.prisma.company.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa ativa encontrada para o usuário.',
      );
    }
    return company.id;
  }

  @Post('fundadores/inscricao')
  @ApiOperation({
    summary:
      'Inscrição no Programa de Fundadores (20 vagas ou lista de espera)',
  })
  @ApiBody({ type: CreateFounderDto })
  @ApiResponse({
    status: 201,
    description:
      'Inscrição realizada com sucesso (vaga reservada ou fila de espera)',
  })
  async registerFounder(@Body() dto: CreateFounderDto) {
    return this.foundersService.registerFounder(dto);
  }

  @Get('fundadores/vagas')
  @ApiOperation({
    summary: 'Consulta pública de disponibilidade de vagas de Fundadores',
  })
  @ApiResponse({
    status: 200,
    description: 'Total de vagas, ocupadas e lista de espera',
  })
  async getVacanciesInfo() {
    return this.foundersService.getVacanciesInfo();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('company/fundador')
  @ApiOperation({
    summary:
      'Retorna status da vaga, lista de espera e progresso de metas do Fundador',
  })
  @ApiResponse({
    status: 200,
    description: 'Status retornado com sucesso',
  })
  async getFounderStatus(@Req() req: Request) {
    const userId = req.user?.['sub'];
    const companyId = await this.getCompanyIdFromUserId(userId);
    return this.foundersService.getFounderStatus(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('company/fundador/aceitar-vaga')
  @ApiOperation({
    summary: 'Aceita uma oferta de vaga liberada da lista de espera',
  })
  @ApiResponse({
    status: 200,
    description: 'Vaga aceita com sucesso',
  })
  async acceptWaitlistOffer(@Req() req: Request) {
    const userId = req.user?.['sub'];
    const companyId = await this.getCompanyIdFromUserId(userId);
    return this.foundersService.acceptWaitlistOffer(companyId);
  }
}
