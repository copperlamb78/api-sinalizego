import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminMetricsDto } from './dto/admin-metrics.dto';
import { AdminCompaniesQueryDto } from './dto/admin-companies-query.dto';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { SYSTEM_MANAGERS } from 'src/common/constants/role-groups.constant';

@ApiTags('Admin — Super Admin & Gestão Global')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SYSTEM_MANAGERS)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({
    summary: 'Métricas Globais da Plataforma (Platform Intelligence)',
    description:
      'Retorna receita consolidada do SaaS, GMV, custos de gateway, métricas de crescimento e ranking de empresas (Restrito a ADMIN e SUPER_ADMIN).',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas globais da plataforma calculadas com sucesso.',
    schema: {
      example: {
        period: {
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-31T23:59:59.999Z',
        },
        financial: {
          platformGrossRevenue: 4500.0,
          totalAsaasPixCosts: 89.1,
          platformNetProfit: 4410.9,
          gmv: 45000.0,
        },
        growth: {
          users: {
            total: 250,
            clients: 210,
            owners: 40,
          },
          companies: {
            total: 40,
            active: 38,
            inactive: 2,
          },
          appointments: {
            total: 1200,
            completed: 980,
            confirmed: 120,
            canceled: 70,
            pendingPayment: 30,
          },
        },
        topTenants: [
          {
            companyId: 'uuid',
            businessName: "Barber's Shop VIP",
            slug: 'barbers-shop-vip',
            appointmentsCount: 250,
            totalRevenue: 12500.0,
            platformFeeGenerated: 1250.0,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Parâmetros de data inválidos.' })
  @ApiResponse({
    status: 403,
    description: 'Acesso proibido para papéis não administrativos.',
  })
  @Get('dashboard/metrics')
  async getDashboardMetrics(@Query() dto?: AdminMetricsDto) {
    return this.adminService.getDashboardMetrics(dto);
  }

  @ApiOperation({
    summary: 'Listagem Administrativa Global de Empresas',
    description:
      'Retorna todas as empresas cadastradas no ecossistema com paginação, filtros por status e busca por nome, cidade ou proprietário.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de empresas retornada com sucesso.',
  })
  @ApiResponse({
    status: 403,
    description: 'Acesso proibido para papéis não administrativos.',
  })
  @Get('companies')
  async listCompanies(@Query() query?: AdminCompaniesQueryDto) {
    return this.adminService.listCompanies(query);
  }

  @ApiOperation({
    summary: 'Ativar / Suspender Administrativamente Estabelecimento',
    description:
      'Alterna o status ativo/inativo de um estabelecimento por infração ou inadimplência.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID (UUID) da empresa a ser suspensa ou reativada',
  })
  @ApiResponse({
    status: 200,
    description: 'Status do estabelecimento atualizado com sucesso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Empresa não encontrada.',
  })
  @ApiResponse({
    status: 403,
    description: 'Acesso proibido para papéis não administrativos.',
  })
  @Patch('companies/:id/toggle-status')
  async toggleCompanyStatus(@Param('id') id: string) {
    return this.adminService.toggleCompanyStatus(id);
  }
}
