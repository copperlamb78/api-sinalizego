import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import {
  CreateCompanyDto,
  CreateCompanyWithoutUserDto,
} from './dto/company-create.dto';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { UpdateCompanyDto } from './dto/company-update.dto';
import type { Request } from 'express';
import { FilterCompanyDto } from './dto/company-filter.dto';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  INTERNAL_USERS,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { Role } from '@prisma/client';

@ApiTags('Empresas')
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('create')
  @ApiBody({
    type: CreateCompanyDto,
    description: 'Criar empresa',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao criar empresa',
  })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiResponse({
    status: 201,
    description: 'Empresa criada com sucesso',
    schema: {
      example: {
        message: 'Empresa criada com sucesso',
        user: {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Carlos Alberto',
          email: 'carlos@barbershop.com',
          phone: '75999999999',
          role: 'COMPANY_OWNER',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          companies: [
            {
              id: 'clsw0s98x000013z81z8z8z8z',
              businessName: "Barber's Shop",
              slug: 'barbers-shop',
              providerType: 'Barbearia',
              district: 'SIM',
              street: 'Artemia Pires Freitas',
              city: 'Feira de Santana',
              state: 'Bahia',
              zipCode: '44085370',
              number: '123',
              whatsapp: '75999999999',
              createdAt: '2026-07-18T10:33:00.000Z',
              isActive: true,
              userId: 'clsw0s98x000013z81z8z8z8z',
            },
          ],
        },
      },
    },
  })
  async createCompany(@Body() data: CreateCompanyDto) {
    return this.companyService.createCompanyWithUser(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('get-by-user-id')
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        whatsapp: '75999999999',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhuma empresa encontrada para este usuário.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getCompanyByUserId(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.companyService.getCompanyByUserId(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('list')
  @ApiResponse({
    status: 200,
    description: 'Lista de empresas retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          businessName: "Barber's Shop",
          slug: 'barbers-shop',
          providerType: 'Barbearia',
          district: 'SIM',
          street: 'Artemia Pires Freitas',
          city: 'Feira de Santana',
          state: 'Bahia',
          zipCode: '44085370',
          number: '123',
          whatsapp: '75999999999',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          userId: 'clsw0s98x000013z81z8z8z8z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhuma empresa encontrada para este usuário.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllCompaniesByUserId(
    @Req() req: Request,
    @Query() filters?: FilterCompanyDto,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.getAllCompaniesByUserId(userId, filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Get('get-all')
  @ApiResponse({
    status: 200,
    description: 'Lista de empresas retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          businessName: "Barber's Shop",
          slug: 'barbers-shop',
          providerType: 'Barbearia',
          district: 'SIM',
          street: 'Artemia Pires Freitas',
          city: 'Feira de Santana',
          state: 'Bahia',
          zipCode: '44085370',
          number: '123',
          whatsapp: '75999999999',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          userId: 'clsw0s98x000013z81z8z8z8z',
        },
      ],
    },
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllCompanies() {
    return this.companyService.getAllCompanies();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('dashboard/metrics')
  @ApiResponse({
    status: 200,
    description:
      'Métricas e relatórios operacionais/financeiros do estabelecimento',
    schema: {
      example: {
        company: {
          id: 'clsw0s98x000013z81z8z8z8z',
          businessName: "Barber's Shop",
          slug: 'barbers-shop',
        },
        period: {
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-23T23:59:59.999Z',
        },
        financial: {
          totalRevenue: 1250.0,
          totalDownPaymentCollected: 625.0,
          totalPlatformFees: 75.0,
          netIncome: 1175.0,
        },
        volume: {
          total: 25,
          completed: 18,
          confirmed: 4,
          canceled: 2,
          pendingPayment: 1,
          completionRate: 75.0,
        },
        topServices: [
          {
            serviceId: 'srv-1',
            serviceName: 'Corte Degradê',
            appointmentsCount: 15,
            totalRevenue: 525.0,
          },
        ],
        upcomingToday: [
          {
            id: 'appt-1',
            appointmentDate: '2026-08-23T14:30:00.000Z',
            appointmentEndDate: '2026-08-23T15:00:00.000Z',
            clientName: 'Carlos Silva',
            clientPhone: '75999999999',
            serviceName: 'Corte Degradê',
            durationMinutes: 30,
            downPaymentAmount: 17.5,
            servicePrice: 35.0,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Parâmetros de data inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({
    status: 404,
    description: 'Estabelecimento não encontrado para este usuário.',
  })
  async getDashboardMetrics(
    @Req() req: Request,
    @Query() dto?: DashboardMetricsDto,
  ) {
    const userId = req.user?.['sub'];
    const userRole = req.user?.['role'] as Role;
    return this.companyService.getDashboardMetrics(userId, userRole, dto);
  }

  @Get('slug/:slug')
  @ApiResponse({
    status: 200,
    description: 'Perfil público do estabelecimento retornado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        whatsapp: '75999999999',
        chairsCount: 2,
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        logoPhoto: 'https://cloudinary.../logo.png',
        bannerPhoto: 'https://cloudinary.../banner.png',
        timezone: 'America/Sao_Paulo',
        createdAt: '2026-07-18T10:33:00.000Z',
        workingHours: [
          {
            id: 'wh-1',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00',
            lunchStartTime: '12:00',
            lunchEndTime: '13:00',
            isClosed: false,
          },
        ],
        serviceGroups: [
          {
            id: 'sg-1',
            name: 'Cabelo e Barba',
            capacity: 2,
            services: [
              {
                id: 'srv-1',
                name: 'Corte Degradê',
                description: 'Corte moderno na tesoura e máquina',
                durationMinutes: 30,
                totalPrice: '35.00',
                downPaymentPercent: 25,
              },
            ],
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Estabelecimento não encontrado.',
  })
  async findBySlug(@Param('slug') slug: string) {
    return this.companyService.findBySlug(slug);
  }

  @Get('get-by-slug/:slug')
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Estabelecimento não encontrado.',
  })
  async getCompanyBySlug(@Param('slug') slug: string) {
    return this.companyService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('update/:companyId')
  @ApiBody({
    type: UpdateCompanyDto,
    description: 'Atualizar empresa',
  })
  @ApiResponse({
    status: 200,
    description: 'Empresa atualizada com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop Atualizada",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        whatsapp: '75999999999',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
        userId: 'clsw0s98x000013z81z8z8z8z',
        banner:
          'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/banner/public_id.jpg',
        logo: 'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/logo/public_id.jpg',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhuma empresa encontrada para este usuário ou empresa.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async updateCompany(
    @Param('companyId') companyId: string,
    @Body() data: UpdateCompanyDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.updateCompany(userId, companyId, data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('deactivate/:companyId')
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @ApiResponse({
    status: 200,
    description: 'Empresa desativada com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        whatsapp: '75999999999',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: false,
        disabledAt: '2026-07-18T10:33:00.000Z',
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhuma empresa encontrada para este usuário ou empresa não encontrada.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async deactivateCompany(
    @Param('companyId') companyId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.deactivateCompany(userId, companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('activate/:companyId')
  @ApiResponse({
    status: 200,
    description: 'Empresa ativada com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        whatsapp: '75999999999',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
        disabledAt: null,
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhuma empresa encontrada para este usuário ou empresa não encontrada.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async activateCompany(
    @Param('companyId') companyId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.activateCompany(userId, companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('create-company-to-user')
  @ApiBody({
    type: CreateCompanyWithoutUserDto,
    description: 'Criar empresa para um usuário existente',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao criar empresa',
  })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiResponse({
    status: 201,
    description: 'Empresa criada com sucesso',
    schema: {
      example: {
        message: 'Empresa criada com sucesso',
        user: {
          id: 'clsw0s98x000013z81z8z8z8z',
          businessName: "Barber's Shop",
          slug: 'barbers-shop',
          providerType: 'Barbearia',
          district: 'SIM',
          street: 'Artemia Pires Freitas',
          city: 'Feira de Santana',
          state: 'Bahia',
          zipCode: '44085370',
          number: '123',
          whatsapp: '75999999999',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          userId: 'clsw0s98x000013z81z8z8z8z',
        },
      },
    },
  })
  async createCompanyToUser(
    @Body() data: CreateCompanyWithoutUserDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.createCompany(data, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('get-by-id/:companyId')
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        whatsapp: '75999999999',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhuma empresa encontrada para este ID.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getCompanyById(@Param('companyId') companyId: string) {
    return this.companyService.getCompanyByCompanyId(companyId);
  }
}
