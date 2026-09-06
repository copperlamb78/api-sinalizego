import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import {
  INTERNAL_NO_EMPLOYEE,
  SYSTEM_MANAGERS,
} from '../../common/constants/role-groups.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { ReviewReferralDto } from './dto/review-referral.dto';
import { ReferralsService } from './referrals.service';

@ApiTags('Indicação')
@Controller()
export class ReferralsController {
  constructor(
    private readonly referralsService: ReferralsService,
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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('company/indicacao/codigo')
  @ApiOperation({
    summary: 'Gera ou retorna o link e código de indicação da empresa',
  })
  @ApiResponse({
    status: 200,
    description: 'Código de indicação retornado com sucesso',
  })
  async getOrCreateCode(@Req() req: Request) {
    const userId = req.user?.['sub'];
    const companyId = await this.getCompanyIdFromUserId(userId);
    return this.referralsService.getOrCreateReferralCode(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('company/indicacoes')
  @ApiOperation({
    summary: 'Lista as indicações realizadas e progresso do teto anual',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de indicações retornada com sucesso',
  })
  async getMyReferrals(@Req() req: Request) {
    const userId = req.user?.['sub'];
    const companyId = await this.getCompanyIdFromUserId(userId);
    return this.referralsService.getCompanyReferrals(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Get('admin/indicacoes')
  @ApiOperation({
    summary: 'Lista indicações em REVIEW para auditoria do Super Admin',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de indicações em análise retornada com sucesso',
  })
  async listReviews() {
    return this.referralsService.listReviewsForAdmin();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Patch('admin/indicacoes/:id/revisar')
  @ApiOperation({
    summary: 'Aprova ou rejeita uma indicação em REVIEW (Super Admin)',
  })
  @ApiBody({ type: ReviewReferralDto })
  @ApiResponse({
    status: 200,
    description: 'Decisão de revisão processada com sucesso',
  })
  async reviewReferral(
    @Param('id') id: string,
    @Body() dto: ReviewReferralDto,
  ) {
    return this.referralsService.reviewReferral(
      id,
      dto.approve,
      dto.rejectedReason,
    );
  }
}
