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

    // Consultas paralelas de alto desempenho via agregações nativas em banco (O-10)
    const [
      statusGroup,
      completedAgg,
      confirmedAgg,
      noShowAgg,
      canceledAgg,
      confirmedTransactions,
      totalUsers,
      clientsCount,
      ownersCount,
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      topTenantsGroupBy,
    ] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: {
          appointmentDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          status: ApptStatus.COMPLETED,
          appointmentDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          servicePrice: true,
          platformFeeAmount: true,
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          status: ApptStatus.CONFIRMED,
          appointmentDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          downPaymentAmount: true,
          platformFeeAmount: true,
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          status: ApptStatus.NO_SHOW,
          appointmentDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          servicePrice: true,
          downPaymentAmount: true,
          retainedDepositAmount: true,
          platformFeeAmount: true,
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          status: ApptStatus.CANCELED,
          appointmentDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          servicePrice: true,
          retainedDepositAmount: true,
          platformFeeAmount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.CONFIRMED,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          asaasFee: true,
          platformAbsorbedFee: true,
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
      this.prisma.appointment.groupBy({
        by: ['companyId'],
        where: {
          appointmentDate: { gte: startDate, lte: endDate },
          status: {
            in: [
              ApptStatus.COMPLETED,
              ApptStatus.CONFIRMED,
              ApptStatus.NO_SHOW,
            ],
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          servicePrice: true,
          downPaymentAmount: true,
          platformFeeAmount: true,
        },
        orderBy: {
          _sum: {
            platformFeeAmount: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    // Pré-população estrita de status para garantir resiliência e evitar undefined
    const appointmentsByStatus: Record<string, number> = {
      [ApptStatus.COMPLETED]: 0,
      [ApptStatus.CONFIRMED]: 0,
      [ApptStatus.PENDING_PAYMENT]: 0,
      [ApptStatus.CANCELED]: 0,
      [ApptStatus.NO_SHOW]: 0,
      PENDING: 0,
      CANCELLED_BY_CLIENT: 0,
      CANCELLED_BY_COMPANY: 0,
    };

    let totalAppointments = 0;
    for (const item of statusGroup) {
      appointmentsByStatus[item.status] = item._count._all;
      totalAppointments += item._count._all;
    }
    appointmentsByStatus.PENDING =
      appointmentsByStatus[ApptStatus.PENDING_PAYMENT];

    const completedCount = appointmentsByStatus[ApptStatus.COMPLETED];
    const confirmedCount = appointmentsByStatus[ApptStatus.CONFIRMED];
    const canceledCount = appointmentsByStatus[ApptStatus.CANCELED];
    const noShowCount = appointmentsByStatus[ApptStatus.NO_SHOW];
    const pendingPaymentCount =
      appointmentsByStatus[ApptStatus.PENDING_PAYMENT];

    const completedPrice = Number(completedAgg._sum.servicePrice || 0);
    const completedFee = Number(completedAgg._sum.platformFeeAmount || 0);

    const confirmedDeposit = Number(confirmedAgg._sum.downPaymentAmount || 0);
    const confirmedFee = Number(confirmedAgg._sum.platformFeeAmount || 0);

    const noShowRetained = Number(
      noShowAgg._sum.retainedDepositAmount ||
        noShowAgg._sum.downPaymentAmount ||
        0,
    );
    const noShowFee = Number(noShowAgg._sum.platformFeeAmount || 0);
    const noShowPotential = Number(noShowAgg._sum.servicePrice || 0);

    const canceledRetained = Number(
      canceledAgg._sum.retainedDepositAmount || 0,
    );
    const canceledFee =
      canceledRetained > 0
        ? Number(canceledAgg._sum.platformFeeAmount || 0)
        : 0;
    const canceledPotential =
      canceledRetained > 0 ? Number(canceledAgg._sum.servicePrice || 0) : 0;

    const gmv =
      completedPrice + confirmedDeposit + noShowRetained + canceledRetained;
    const platformGrossRevenue =
      completedFee + confirmedFee + noShowFee + canceledFee;

    const totalRetainedLossPrevented = noShowRetained + canceledRetained;
    const totalPotentialLostRevenue = noShowPotential + canceledPotential;
    const retainedAppointmentsCount =
      noShowCount + (canceledRetained > 0 ? canceledCount : 0);

    // Top Tenants
    const topCompanyIds = topTenantsGroupBy.map((t) => t.companyId);
    const topCompanies =
      topCompanyIds.length > 0
        ? await this.prisma.company.findMany({
            where: { id: { in: topCompanyIds } },
            select: { id: true, businessName: true, slug: true },
          })
        : [];
    const companyMap = new Map(topCompanies.map((c) => [c.id, c]));

    const topTenants = topTenantsGroupBy.map((t) => {
      const comp = companyMap.get(t.companyId);
      const totalRevenue =
        Number(t._sum.servicePrice || 0) +
        Number(t._sum.downPaymentAmount || 0);
      const platformFeeGenerated = Number(t._sum.platformFeeAmount || 0);

      return {
        companyId: t.companyId,
        businessName: comp?.businessName || 'Desconhecido',
        slug: comp?.slug || '',
        appointmentsCount: t._count._all,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        platformFeeGenerated: Number(platformFeeGenerated.toFixed(2)),
      };
    });

    // Custos de gateway absorvidos pela plataforma (tarifa real > R$ 0,99 — N2 / A10)
    let totalPlatformAbsorbedCosts = 0;
    if (
      confirmedTransactions &&
      confirmedTransactions._sum &&
      confirmedTransactions._sum.platformAbsorbedFee !== null &&
      confirmedTransactions._sum.platformAbsorbedFee !== undefined
    ) {
      totalPlatformAbsorbedCosts = Number(
        confirmedTransactions._sum.platformAbsorbedFee,
      );
    }

    const platformNetProfit = Math.max(
      0,
      platformGrossRevenue - totalPlatformAbsorbedCosts,
    );

    const protectionEfficiencyRate =
      totalPotentialLostRevenue > 0
        ? Number(
            (
              (totalRetainedLossPrevented / totalPotentialLostRevenue) *
              100
            ).toFixed(2),
          )
        : 0;

    const lossPrevented = {
      totalLossPrevented: Number(totalRetainedLossPrevented.toFixed(2)),
      retainedAppointmentsCount,
      estimatedLossWithoutApp: Number(totalPotentialLostRevenue.toFixed(2)),
      protectionEfficiencyRate,
    };

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      financial: {
        platformGrossRevenue: Number((platformGrossRevenue || 0).toFixed(2)),
        platformFeeInEscrow: Number((confirmedFee || 0).toFixed(2)),
        totalAsaasPixCosts: Number(
          (totalPlatformAbsorbedCosts || 0).toFixed(2),
        ),
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
          total: totalAppointments,
          completed: completedCount ?? 0,
          confirmed: confirmedCount ?? 0,
          canceled: canceledCount ?? 0,
          noShow: noShowCount ?? 0,
          pendingPayment: pendingPaymentCount ?? 0,
          byStatus: appointmentsByStatus,
        },
        appointmentsByStatus,
      },
      lossPrevented,
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
