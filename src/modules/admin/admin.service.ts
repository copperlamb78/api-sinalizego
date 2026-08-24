import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminMetricsDto } from './dto/admin-metrics.dto';
import { AdminCompaniesQueryDto } from './dto/admin-companies-query.dto';
import { ApptStatus, Prisma, Role, TransactionStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Métricas Globais da Plataforma e Inteligência Operacional (Super Admin Dashboard)
   */
  async getDashboardMetrics(dto?: AdminMetricsDto) {
    const now = new Date();

    let startDate: Date;
    if (dto?.startDate) {
      startDate = new Date(dto.startDate + 'T00:00:00.000Z');
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException(
          'Formato inválido para startDate (YYYY-MM-DD).',
        );
      }
    } else {
      // 1º dia do mês corrente às 00:00:00
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    let endDate: Date;
    if (dto?.endDate) {
      endDate = new Date(dto.endDate + 'T23:59:59.999Z');
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException(
          'Formato inválido para endDate (YYYY-MM-DD).',
        );
      }
    } else {
      // Fim do dia atual às 23:59:59
      endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    // Consultas paralelas de alto desempenho
    const [
      appointments,
      confirmedTransactions,
      totalUsers,
      clientsCount,
      ownersCount,
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          appointmentDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          status: true,
          servicePrice: true,
          downPaymentAmount: true,
          platformFeeAmount: true,
          companyId: true,
          company: {
            select: {
              id: true,
              businessName: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          status: TransactionStatus.CONFIRMED,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          totalValue: true,
          netValue: true,
          platformFee: true,
          asaasFee: true,
        },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: Role.CLIENT, isActive: true } }),
      this.prisma.user.count({
        where: { role: Role.COMPANY_OWNER, isActive: true },
      }),
      this.prisma.company.count(),
      this.prisma.company.count({ where: { isActive: true } }),
      this.prisma.company.count({ where: { isActive: false } }),
    ]);

    let platformGrossRevenue = 0;
    let gmv = 0;

    let completedCount = 0;
    let confirmedCount = 0;
    let canceledCount = 0;
    let pendingPaymentCount = 0;

    // Pré-população estrita de status para garantir resiliência e evitar undefined
    const appointmentsByStatus: Record<string, number> = {
      [ApptStatus.COMPLETED]: 0,
      [ApptStatus.CONFIRMED]: 0,
      [ApptStatus.PENDING_PAYMENT]: 0,
      [ApptStatus.CANCELED]: 0,
      PENDING: 0,
      CANCELLED_BY_CLIENT: 0,
      CANCELLED_BY_COMPANY: 0,
      NO_SHOW: 0,
    };

    const tenantsMap = new Map<
      string,
      {
        companyId: string;
        businessName: string;
        slug: string;
        appointmentsCount: number;
        totalRevenue: number;
        platformFeeGenerated: number;
      }
    >();

    for (const appt of appointments) {
      const price = Number(appt.servicePrice || 0);
      const downPayment = Number(appt.downPaymentAmount || 0);
      const platformFee = Number(appt.platformFeeAmount || 0);

      appointmentsByStatus[appt.status] =
        (appointmentsByStatus[appt.status] || 0) + 1;

      switch (appt.status) {
        case ApptStatus.COMPLETED:
          completedCount++;
          gmv += price;
          platformGrossRevenue += platformFee;
          break;
        case ApptStatus.CONFIRMED:
          confirmedCount++;
          gmv += downPayment;
          platformGrossRevenue += platformFee;
          break;
        case ApptStatus.CANCELED:
          canceledCount++;
          break;
        case ApptStatus.PENDING_PAYMENT:
          pendingPaymentCount++;
          appointmentsByStatus.PENDING = pendingPaymentCount;
          break;
      }

      // Agrupamento por Empresa (Top Tenants)
      if (
        (appt.status === ApptStatus.COMPLETED ||
          appt.status === ApptStatus.CONFIRMED) &&
        appt.company
      ) {
        const existing = tenantsMap.get(appt.companyId) || {
          companyId: appt.company.id,
          businessName: appt.company.businessName,
          slug: appt.company.slug,
          appointmentsCount: 0,
          totalRevenue: 0,
          platformFeeGenerated: 0,
        };

        existing.appointmentsCount += 1;
        existing.totalRevenue +=
          appt.status === ApptStatus.COMPLETED ? price : downPayment;
        existing.platformFeeGenerated += platformFee;
        tenantsMap.set(appt.companyId, existing);
      }
    }

    // Cálculo das taxas Asaas Pix
    let totalAsaasPixCosts = 0;
    if (confirmedTransactions.length > 0) {
      totalAsaasPixCosts = confirmedTransactions.reduce(
        (sum, t) => sum + Number(t.asaasFee || 0),
        0,
      );
    } else {
      // Fallback para taxa padrão de 0.99 por agendamento liquidado
      totalAsaasPixCosts = (completedCount + confirmedCount) * 0.99;
    }

    const platformNetProfit = Math.max(
      0,
      platformGrossRevenue - totalAsaasPixCosts,
    );

    const topTenants = Array.from(tenantsMap.values())
      .sort(
        (a, b) =>
          b.platformFeeGenerated - a.platformFeeGenerated ||
          b.totalRevenue - a.totalRevenue,
      )
      .slice(0, 5)
      .map((tenant) => ({
        ...tenant,
        totalRevenue: Number(tenant.totalRevenue.toFixed(2)),
        platformFeeGenerated: Number(tenant.platformFeeGenerated.toFixed(2)),
      }));

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      financial: {
        platformGrossRevenue: Number((platformGrossRevenue || 0).toFixed(2)),
        totalAsaasPixCosts: Number((totalAsaasPixCosts || 0).toFixed(2)),
        platformNetProfit: Number((platformNetProfit || 0).toFixed(2)),
        gmv: Number((gmv || 0).toFixed(2)),
      },
      growth: {
        users: {
          total: totalUsers ?? 0,
          clients: clientsCount ?? 0,
          owners: ownersCount ?? 0,
        },
        companies: {
          total: totalCompanies ?? 0,
          active: activeCompanies ?? 0,
          inactive: inactiveCompanies ?? 0,
        },
        appointments: {
          total: appointments.length ?? 0,
          completed: completedCount ?? 0,
          confirmed: confirmedCount ?? 0,
          canceled: canceledCount ?? 0,
          pendingPayment: pendingPaymentCount ?? 0,
          byStatus: appointmentsByStatus,
        },
        appointmentsByStatus,
      },
      appointmentsByStatus,
      topTenants,
    };
  }

  /**
   * Listagem Administrativa Global de Empresas com Paginação e Filtros
   */
  async listCompanies(query?: AdminCompaniesQueryDto) {
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (query?.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query?.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query?.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { owner: { email: { contains: search, mode: 'insensitive' } } },
        { owner: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          businessName: true,
          slug: true,
          providerType: true,
          district: true,
          street: true,
          city: true,
          state: true,
          zipCode: true,
          number: true,
          whatsapp: true,
          logoPhoto: true,
          bannerPhoto: true,
          timezone: true,
          isActive: true,
          createdAt: true,
          disabledAt: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          _count: {
            select: {
              appointments: true,
              services: true,
              serviceGroups: true,
            },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: companies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Ativar / Suspender Administrativamente uma Empresa
   */
  async toggleCompanyStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const nextIsActive = !company.isActive;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        isActive: nextIsActive,
        disabledAt: nextIsActive ? null : new Date(),
      },
      select: {
        id: true,
        businessName: true,
        slug: true,
        isActive: true,
        disabledAt: true,
      },
    });

    return {
      message: nextIsActive
        ? 'Estabelecimento reativado com sucesso.'
        : 'Estabelecimento suspenso com sucesso.',
      company: updated,
    };
  }
}
