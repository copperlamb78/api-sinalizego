import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  CreateCompanyDto,
  CreateCompanyWithoutUserDto,
} from './dto/company-create.dto';
import { SlugHelper } from './helpers/create-slug.helper';
import { UpdateCompanyDto } from './dto/company-update.dto';
import { FilterCompanyDto } from './dto/company-filter.dto';
import { AuthService } from '../auth/auth.service';
import {
  ApptStatus,
  BillingType,
  Role,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { AsaasService } from 'src/asaas/asaas.service';
import {
  ASAAS_TRANSFER_FEE,
  MIN_FREE_WEEKLY_PAYOUT,
} from 'src/common/constants/billing.constant';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slugHelper: SlugHelper,
    private readonly authService: AuthService,
    private readonly asaasService: AsaasService,
  ) {}

  async createCompanyWithUser(data: CreateCompanyDto) {
    if (await this.prisma.user.findUnique({ where: { email: data.email } })) {
      throw new ConflictException('O e-mail já está em uso');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const slug = await this.slugHelper.createSlug(data.businessName);

    const companyUser = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: 'COMPANY_OWNER',

        companies: {
          create: {
            businessName: data.businessName,
            slug: slug,
            providerType: data.providerType,
            district: data.district,
            street: data.street,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            number: data.number,
            whatsapp: data.phone,
          },
        },
      },
      include: {
        companies: true,
      },
    });

    const { password, ...companyUserWithoutPassword } = companyUser;

    const tokens = await this.authService.getTokens(
      companyUser.id,
      companyUser.email,
      'COMPANY_OWNER',
    );
    await this.authService.updateRefreshTokenHash(
      companyUser.id,
      tokens.refreshToken,
    );

    return {
      message: 'Empresa criada com sucesso',
      user: companyUserWithoutPassword,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async createCompany(data: CreateCompanyWithoutUserDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const slug = await this.slugHelper.createSlug(data.businessName);

    const company = await this.prisma.company.create({
      data: {
        businessName: data.businessName,
        slug: slug,
        providerType: data.providerType,
        district: data.district,
        street: data.street,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        number: data.number,
        whatsapp: data.phone,
        userId: userId,
      },
    });

    if (user.role !== 'COMPANY_OWNER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'COMPANY_OWNER' },
      });
    }

    const tokens = await this.authService.getTokens(
      user.id,
      user.email,
      'COMPANY_OWNER',
    );
    await this.authService.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      message: 'Empresa criada com sucesso',
      user: company,
      company: company,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async getCompanyByCompanyId(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Nenhuma empresa encontrada para este ID.');
    }
    return company;
  }

  async getCompanyByUserId(userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }
    return company;
  }

  async getAllCompaniesByUserId(userId: string, filters?: FilterCompanyDto) {
    const whereClause: any = { userId: userId };
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.businessName) whereClause.businessName = filters.businessName;
      if (filters.providerType) whereClause.providerType = filters.providerType;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const companies = await this.prisma.company.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    if (!companies) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    return companies;
  }

  async getAllCompanies() {
    const companies = await this.prisma.company.findMany();

    if (!companies) {
      throw new NotFoundException('Nenhuma empresa encontrada.');
    }
    return companies;
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: slug, isActive: true },
      select: {
        id: true,
        businessName: true,
        slug: true,
        providerType: true,
        whatsapp: true,
        chairsCount: true,
        district: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        number: true,
        logoPhoto: true,
        bannerPhoto: true,
        timezone: true,
        createdAt: true,
        workingHours: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            lunchStartTime: true,
            lunchEndTime: true,
            isClosed: true,
          },
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
        serviceGroups: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            capacity: true,
            services: {
              where: {
                isActive: true,
              },
              select: {
                id: true,
                name: true,
                description: true,
                durationMinutes: true,
                totalPrice: true,
                downPaymentPercent: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Estabelecimento não encontrado.');
    }

    return company;
  }

  async getCompanyBySlug(slug: string) {
    return this.findBySlug(slug);
  }

  async updateCompany(
    userId: string,
    companyId: string,
    data: UpdateCompanyDto,
  ) {
    const companyExists = await this.prisma.company.findFirst({
      where: { userId: userId, id: companyId },
    });

    if (!companyExists) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return this.prisma.company.update({
      where: { id: companyExists.id },
      data: data,
    });
  }

  async deactivateCompany(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId, id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id: company.id },
      data: { isActive: false, disabledAt: new Date() },
    });

    return updatedCompany;
  }

  async activateCompany(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId, id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id: company.id },
      data: { isActive: true, disabledAt: null },
    });

    return updatedCompany;
  }

  /**
   * Métricas & Relatórios Operacionais e Financeiros do Estabelecimento (Dashboard do Dono)
   */
  async getDashboardMetrics(
    userId: string,
    userRole: Role,
    dto?: DashboardMetricsDto,
  ) {
    let company: { id: string; businessName: string; slug: string } | null =
      null;

    if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) {
      if (dto?.companyId) {
        company = await this.prisma.company.findFirst({
          where: { id: dto.companyId, isActive: true },
          select: { id: true, businessName: true, slug: true },
        });
        if (!company) {
          throw new NotFoundException('Estabelecimento não encontrado.');
        }
      } else {
        company = await this.prisma.company.findFirst({
          where: { userId, isActive: true },
          select: { id: true, businessName: true, slug: true },
        });
        if (!company) {
          throw new BadRequestException(
            'Informe o companyId para consultar as métricas do estabelecimento.',
          );
        }
      }
    } else {
      // Dono de estabelecimento (COMPANY_OWNER)
      company = await this.prisma.company.findFirst({
        where: { userId, isActive: true },
        select: { id: true, businessName: true, slug: true },
      });
      if (!company) {
        throw new NotFoundException(
          'Estabelecimento não encontrado para este usuário.',
        );
      }
    }

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

    // Busca agendamentos do período
    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
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
        retainedDepositAmount: true,
        appointmentDate: true,
        serviceId: true,
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
          },
        },
        client: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalDownPaymentCollected = 0;
    let totalPlatformFees = 0;

    let completedCount = 0;
    let confirmedCount = 0;
    let canceledCount = 0;
    let noShowCount = 0;
    let pendingPaymentCount = 0;

    // Métricas de Prejuízo Evitado (Loss Prevention Intelligence)
    let totalRetainedLossPrevented = 0;
    let totalProtectedMinutes = 0;
    let totalPotentialLostRevenue = 0;
    const protectedAppointmentsList: Array<{
      id: string;
      clientName: string;
      clientPhone: string | null;
      serviceName: string;
      appointmentDate: Date;
      servicePrice: number;
      retainedAmount: number;
      reason: string;
    }> = [];

    const servicesMap = new Map<
      string,
      {
        serviceId: string;
        serviceName: string;
        appointmentsCount: number;
        totalRevenue: number;
      }
    >();

    for (const appt of appointments) {
      const price = Number(appt.servicePrice || 0);
      const downPayment = Number(appt.downPaymentAmount || 0);
      const platformFee = Number(appt.platformFeeAmount || 0);

      switch (appt.status) {
        case ApptStatus.COMPLETED:
          completedCount++;
          totalRevenue += price;
          totalDownPaymentCollected += downPayment;
          totalPlatformFees += platformFee;
          break;
        case ApptStatus.CONFIRMED:
          confirmedCount++;
          totalDownPaymentCollected += downPayment;
          totalPlatformFees += platformFee;
          break;
        case ApptStatus.NO_SHOW: {
          noShowCount++;
          const noShowRetained = Number(
            appt.retainedDepositAmount || appt.downPaymentAmount || 0,
          );
          totalDownPaymentCollected += noShowRetained;
          totalRetainedLossPrevented += noShowRetained;
          totalProtectedMinutes += appt.service?.durationMinutes || 30;
          totalPotentialLostRevenue += price;
          protectedAppointmentsList.push({
            id: appt.id,
            clientName: appt.client?.name || 'Cliente',
            clientPhone: appt.client?.phone || null,
            serviceName: appt.service?.name || 'Serviço',
            appointmentDate: appt.appointmentDate,
            servicePrice: price,
            retainedAmount: Number(noShowRetained.toFixed(2)),
            reason: 'Não Compareceu (No-Show)',
          });
          break;
        }
        case ApptStatus.CANCELED: {
          canceledCount++;
          const canceledRetained = Number(appt.retainedDepositAmount || 0);
          if (canceledRetained > 0) {
            totalDownPaymentCollected += canceledRetained;
            totalRetainedLossPrevented += canceledRetained;
            totalProtectedMinutes += appt.service?.durationMinutes || 30;
            totalPotentialLostRevenue += price;
            protectedAppointmentsList.push({
              id: appt.id,
              clientName: appt.client?.name || 'Cliente',
              clientPhone: appt.client?.phone || null,
              serviceName: appt.service?.name || 'Serviço',
              appointmentDate: appt.appointmentDate,
              servicePrice: price,
              retainedAmount: Number(canceledRetained.toFixed(2)),
              reason: 'Cancelamento Tardio (<= 24h)',
            });
          }
          break;
        }
        case ApptStatus.PENDING_PAYMENT:
          pendingPaymentCount++;
          break;
      }

      // Top serviços (agendamentos confirmados ou concluídos)
      if (
        (appt.status === ApptStatus.COMPLETED ||
          appt.status === ApptStatus.CONFIRMED) &&
        appt.service
      ) {
        const existing = servicesMap.get(appt.serviceId) || {
          serviceId: appt.service.id,
          serviceName: appt.service.name,
          appointmentsCount: 0,
          totalRevenue: 0,
        };
        existing.appointmentsCount += 1;
        existing.totalRevenue += price;
        servicesMap.set(appt.serviceId, existing);
      }
    }

    const totalAppointments = appointments.length;
    const validCount =
      completedCount + confirmedCount + canceledCount + noShowCount;
    const completionRate =
      validCount > 0
        ? Number(((completedCount / validCount) * 100).toFixed(2))
        : 0;

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
      retainedAppointmentsCount: protectedAppointmentsList.length,
      totalProtectedHours: Number((totalProtectedMinutes / 60).toFixed(1)),
      estimatedLossWithoutApp: Number(totalPotentialLostRevenue.toFixed(2)),
      protectionEfficiencyRate,
      recentProtectedAppointments: protectedAppointmentsList.slice(0, 10),
    };

    const topServices = Array.from(servicesMap.values())
      .sort(
        (a, b) =>
          b.appointmentsCount - a.appointmentsCount ||
          b.totalRevenue - a.totalRevenue,
      )
      .slice(0, 5)
      .map((s) => ({
        ...s,
        totalRevenue: Number(s.totalRevenue.toFixed(2)),
      }));

    // Agendamentos futuros do dia de hoje (Upcoming Today)
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const upcomingTodayRaw = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        status: ApptStatus.CONFIRMED,
        appointmentDate: {
          gte: now,
          lte: todayEnd,
        },
      },
      orderBy: {
        appointmentDate: 'asc',
      },
      take: 10,
      select: {
        id: true,
        appointmentDate: true,
        appointmentEndDate: true,
        downPaymentAmount: true,
        servicePrice: true,
        client: {
          select: {
            name: true,
            phone: true,
          },
        },
        service: {
          select: {
            name: true,
            durationMinutes: true,
          },
        },
      },
    });

    const upcomingToday = upcomingTodayRaw.map((appt) => ({
      id: appt.id,
      appointmentDate: appt.appointmentDate,
      appointmentEndDate: appt.appointmentEndDate,
      clientName: appt.client?.name || 'Cliente',
      clientPhone: appt.client?.phone || null,
      serviceName: appt.service?.name || 'Serviço',
      durationMinutes: appt.service?.durationMinutes || 0,
      downPaymentAmount: Number(appt.downPaymentAmount || 0),
      servicePrice: Number(appt.servicePrice || 0),
      amountToPayInSalon: Number(
        (
          Number(appt.servicePrice || 0) - Number(appt.downPaymentAmount || 0)
        ).toFixed(2),
      ),
    }));

    // Busca saques realizados da empresa para deduzir do saldo disponível
    let totalWithdrawn = 0;
    const companyProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: [
          { userId },
          { companies: { some: { id: company.id } } },
        ],
        isActive: true,
      },
      select: { id: true, walletId: true },
    });

    if (companyProfile?.walletId) {
      const withdrawals = await this.prisma.transaction.findMany({
        where: {
          barberWalletId: companyProfile.walletId,
          type: TransactionType.WITHDRAWAL,
          status: { in: [TransactionStatus.CONFIRMED, TransactionStatus.PENDING] },
        },
        select: { totalValue: true },
      });
      totalWithdrawn = withdrawals.reduce(
        (acc, w) => acc + Number(w.totalValue || 0),
        0,
      );
    }

    const completedDepositsNet = appointments
      .filter((a) => a.status === ApptStatus.COMPLETED)
      .reduce((acc, a) => acc + Number(a.downPaymentAmount || 0), 0);

    const noShowDeposits = appointments
      .filter((a) => a.status === ApptStatus.NO_SHOW)
      .reduce(
        (acc, a) =>
          acc + Number(a.retainedDepositAmount || a.downPaymentAmount || 0),
        0,
      );

    const canceledRetainedDeposits = appointments
      .filter(
        (a) =>
          a.status === ApptStatus.CANCELED &&
          Number(a.retainedDepositAmount || 0) > 0,
      )
      .reduce((acc, a) => acc + Number(a.retainedDepositAmount || 0), 0);

    const totalEarnedDeposits =
      completedDepositsNet + noShowDeposits + canceledRetainedDeposits;

    const escrowLockedBalance = appointments
      .filter((a) => a.status === ApptStatus.CONFIRMED)
      .reduce((acc, a) => acc + Number(a.downPaymentAmount || 0), 0);

    const availableBalance = Math.max(
      0,
      Number((totalEarnedDeposits - totalWithdrawn).toFixed(2)),
    );

    return {
      company: {
        id: company.id,
        businessName: company.businessName,
        slug: company.slug,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      financial: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalDownPaymentCollected: Number(totalDownPaymentCollected.toFixed(2)),
        totalPlatformFees: Number(totalPlatformFees.toFixed(2)),
        netIncome: Number(
          Math.max(0, totalRevenue - totalPlatformFees).toFixed(2),
        ),
        availableBalance: Number(availableBalance.toFixed(2)),
        escrowLockedBalance: Number(escrowLockedBalance.toFixed(2)),
        totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
      },
      volume: {
        total: totalAppointments,
        completed: completedCount,
        confirmed: confirmedCount,
        canceled: canceledCount,
        noShow: noShowCount,
        pendingPayment: pendingPaymentCount,
        completionRate,
      },
      lossPrevented,
      topServices,
      upcomingToday,
    };
  }

  /**
   * Consulta o saldo detalhado da empresa: disponível, em custódia (Escrow Hold) e histórico de saques.
   */
  async getCompanyBalance(userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId, isActive: true },
      select: { id: true, businessName: true, financialProfileId: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Estabelecimento não encontrado para este usuário.',
      );
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: [
          { userId },
          { id: company.financialProfileId || undefined },
          { companies: { some: { id: company.id } } },
        ],
        isActive: true,
      },
      select: { id: true, walletId: true },
    });

    if (!financialProfile?.walletId) {
      throw new BadRequestException(
        'Estabelecimento não possui perfil financeiro ou subconta Asaas configurada.',
      );
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
      },
      select: {
        status: true,
        downPaymentAmount: true,
        retainedDepositAmount: true,
      },
    });

    const completedNetRevenue = appointments
      .filter((a) => a.status === ApptStatus.COMPLETED)
      .reduce((acc, a) => acc + Number(a.downPaymentAmount || 0), 0);

    const noShowNetRevenue = appointments
      .filter((a) => a.status === ApptStatus.NO_SHOW)
      .reduce(
        (acc, a) =>
          acc + Number(a.retainedDepositAmount || a.downPaymentAmount || 0),
        0,
      );

    const canceledRetainedRevenue = appointments
      .filter(
        (a) =>
          a.status === ApptStatus.CANCELED &&
          Number(a.retainedDepositAmount || 0) > 0,
      )
      .reduce((acc, a) => acc + Number(a.retainedDepositAmount || 0), 0);

    const totalEarnedRevenue =
      completedNetRevenue + noShowNetRevenue + canceledRetainedRevenue;

    const escrowLockedBalance = appointments
      .filter((a) => a.status === ApptStatus.CONFIRMED)
      .reduce((acc, a) => acc + Number(a.downPaymentAmount || 0), 0);

    const withdrawals = await this.prisma.transaction.findMany({
      where: {
        barberWalletId: financialProfile.walletId,
        type: TransactionType.WITHDRAWAL,
        status: {
          in: [TransactionStatus.CONFIRMED, TransactionStatus.PENDING],
        },
      },
      select: { totalValue: true },
    });

    const totalWithdrawn = withdrawals.reduce(
      (acc, w) => acc + Number(w.totalValue || 0),
      0,
    );

    const availableBalance = Math.max(
      0,
      Number((totalEarnedRevenue - totalWithdrawn).toFixed(2)),
    );

    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(6, 0, 0, 0);

    return {
      companyId: company.id,
      businessName: company.businessName,
      walletId: financialProfile.walletId,
      availableBalance: Number(availableBalance.toFixed(2)),
      escrowLockedBalance: Number(escrowLockedBalance.toFixed(2)),
      completedNetRevenue: Number(completedNetRevenue.toFixed(2)),
      totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
      nextFreeWithdrawalDate: nextMonday.toISOString(),
      instantTransferFee: ASAAS_TRANSFER_FEE,
      minFreeWeeklyPayoutThreshold: MIN_FREE_WEEKLY_PAYOUT,
      eligibleForFreeWeeklyPayout:
        availableBalance >= MIN_FREE_WEEKLY_PAYOUT,
    };
  }

  /**
   * Solicita saque avulso sob demanda fora do ciclo semanal com proteção atômica anti-race condition e dedução de tarifa.
   */
  async requestInstantWithdrawal(userId: string, dto?: WithdrawDto) {
    const company = await this.prisma.company.findFirst({
      where: { userId, isActive: true },
      select: { id: true, businessName: true, financialProfileId: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Estabelecimento não encontrado para este usuário.',
      );
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: [
          { userId },
          { id: company.financialProfileId || undefined },
          { companies: { some: { id: company.id } } },
        ],
        isActive: true,
      },
      select: { id: true, walletId: true },
    });

    if (!financialProfile?.walletId) {
      throw new BadRequestException(
        'Estabelecimento não possui perfil financeiro ou subconta Asaas configurada.',
      );
    }

    const transferFee = ASAAS_TRANSFER_FEE;

    // 1. Transação Interativa Atômica com Reserva Imediata de Saldo (Anti-Race Condition Lock)
    const {
      pendingTx,
      requestedAmount,
      netAmountTransferred,
      remainingBalance,
      escrowLockedBalance,
    } = await this.prisma.$transaction(async (tx) => {
      // Bloqueio de Concorrência: Verifica se já existe um saque PENDING em voo
      const inFlightWithdrawal = await tx.transaction.findFirst({
        where: {
          barberWalletId: financialProfile.walletId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
        },
      });

      if (inFlightWithdrawal) {
        throw new ConflictException(
          'Já existe uma solicitação de saque em processamento para este estabelecimento. Aguarde a conclusão da transferência.',
        );
      }

      // Busca agendamentos da empresa para apuração de saldo
      const appointments = await tx.appointment.findMany({
        where: {
          companyId: company.id,
        },
        select: {
          status: true,
          downPaymentAmount: true,
          retainedDepositAmount: true,
        },
      });

      const completedNetRevenue = appointments
        .filter((a) => a.status === ApptStatus.COMPLETED)
        .reduce((acc, a) => acc + Number(a.downPaymentAmount || 0), 0);

      const noShowNetRevenue = appointments
        .filter((a) => a.status === ApptStatus.NO_SHOW)
        .reduce(
          (acc, a) =>
            acc + Number(a.retainedDepositAmount || a.downPaymentAmount || 0),
          0,
        );

      const canceledRetainedRevenue = appointments
        .filter(
          (a) =>
            a.status === ApptStatus.CANCELED &&
            Number(a.retainedDepositAmount || 0) > 0,
        )
        .reduce((acc, a) => acc + Number(a.retainedDepositAmount || 0), 0);

      const totalEarnedRevenue =
        completedNetRevenue + noShowNetRevenue + canceledRetainedRevenue;

      const escrowLocked = appointments
        .filter((a) => a.status === ApptStatus.CONFIRMED)
        .reduce((acc, a) => acc + Number(a.downPaymentAmount || 0), 0);

      // Saques já realizados ou em processamento (CONFIRMED ou PENDING)
      const withdrawals = await tx.transaction.findMany({
        where: {
          barberWalletId: financialProfile.walletId,
          type: TransactionType.WITHDRAWAL,
          status: {
            in: [TransactionStatus.CONFIRMED, TransactionStatus.PENDING],
          },
        },
        select: { totalValue: true },
      });

      const totalWithdrawn = withdrawals.reduce(
        (acc, w) => acc + Number(w.totalValue || 0),
        0,
      );

      const currentAvailableBalance = Math.max(
        0,
        Number((totalEarnedRevenue - totalWithdrawn).toFixed(2)),
      );

      if (currentAvailableBalance <= 0) {
        throw new BadRequestException(
          'Saldo disponível insuficiente para saque. Os valores de agendamentos ainda não realizados permanecem em custódia (Escrow Hold) até a conclusão do atendimento.',
        );
      }

      const requested = dto?.amount
        ? Number(dto.amount)
        : currentAvailableBalance;

      if (requested > currentAvailableBalance) {
        throw new BadRequestException(
          `O valor solicitado (R$ ${requested.toFixed(2)}) excede o saldo disponível liberado para saque (R$ ${currentAvailableBalance.toFixed(2)}).`,
        );
      }

      if (requested <= transferFee) {
        throw new BadRequestException(
          `O valor solicitado para saque avulso deve ser superior à taxa de transferência bancária de R$ ${transferFee.toFixed(2)}.`,
        );
      }

      const netTransferred = Number((requested - transferFee).toFixed(2));

      // Reserva imediatamente o saldo inserindo a Transaction como PENDING
      const reservedTx = await tx.transaction.create({
        data: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          totalValue: requested,
          netValue: netTransferred,
          platformFee: 0,
          asaasFee: transferFee,
          billingType: BillingType.PIX,
          barberWalletId: financialProfile.walletId,
        },
      });

      return {
        pendingTx: reservedTx,
        requestedAmount: requested,
        netAmountTransferred: netTransferred,
        remainingBalance: Number(
          (currentAvailableBalance - requested).toFixed(2),
        ),
        escrowLockedBalance: Number(escrowLocked.toFixed(2)),
      };
    });

    // 2. Chamada à API de Transferência do Asaas (fora da transação de banco para evitar lock prolongado)
    let asaasResult: any = null;
    try {
      asaasResult = await this.asaasService.transferSubaccountBalance(
        financialProfile.id,
        netAmountTransferred,
        { isFreeWeekly: false },
      );
    } catch (err: any) {
      this.logger.error(
        `Falha ao executar transferência Asaas para subconta #${financialProfile.id}: ${err?.message || err}. Revertendo reserva de saldo...`,
      );
      // Reverte a transação reservada para CANCELED para liberar o saldo do cliente
      await this.prisma.transaction.update({
        where: { id: pendingTx.id },
        data: { status: TransactionStatus.CANCELED },
      });
      throw err;
    }

    // 3. Sucesso no gateway: Confirma a transação no banco
    const confirmedTx = await this.prisma.transaction.update({
      where: { id: pendingTx.id },
      data: {
        status: TransactionStatus.CONFIRMED,
        asaasPaymentId:
          asaasResult?.id ||
          `with_${Date.now()}_${company.id.slice(0, 6)}`,
      },
    });

    return {
      message: 'Saque avulso solicitado com sucesso.',
      withdrawal: {
        id: confirmedTx.id,
        requestedAmount: Number(requestedAmount.toFixed(2)),
        transferFee: Number(transferFee.toFixed(2)),
        netAmountTransferred: Number(netAmountTransferred.toFixed(2)),
        status: TransactionStatus.CONFIRMED,
        transferredAt: confirmedTx.createdAt,
        remainingAvailableBalance: remainingBalance,
        escrowLockedBalance,
      },
    };
  }

  /**
   * Consulta o histórico completo de saques e transferências da empresa com auditoria detalhada.
   */
  async getCompanyWithdrawalHistory(userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId, isActive: true },
      select: { id: true, financialProfileId: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Estabelecimento não encontrado para este usuário.',
      );
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: [
          { userId },
          { id: company.financialProfileId || undefined },
          { companies: { some: { id: company.id } } },
        ],
        isActive: true,
      },
      select: { walletId: true },
    });

    if (!financialProfile?.walletId) {
      return [];
    }

    const withdrawals = await this.prisma.transaction.findMany({
      where: {
        barberWalletId: financialProfile.walletId,
        type: TransactionType.WITHDRAWAL,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalValue: true,
        netValue: true,
        asaasFee: true,
        status: true,
        asaasPaymentId: true,
        createdAt: true,
      },
    });

    return withdrawals.map((w) => ({
      id: w.id,
      requestedAmount: Number(w.totalValue),
      netAmountTransferred: Number(w.netValue),
      transferFee: Number(w.asaasFee),
      isFreeWeekly: Number(w.asaasFee) === 0,
      status: w.status,
      asaasTransferId: w.asaasPaymentId || null,
      transferredAt: w.createdAt,
    }));
  }

  /**
   * Cron Job semanal para saque automático gratuito toda segunda-feira às 06:00.
   * Transfere o saldo liberado sem cobrança de tarifa de transferência para o estabelecimento com idempotência diária.
   */
  @Cron('0 6 * * 1')
  async executeWeeklyFreePayouts(): Promise<number> {
    this.logger.log(
      '[Cron Payouts] Iniciando rotina de saques automáticos semanais gratuitos...',
    );
    try {
      const activeCompanies = await this.prisma.company.findMany({
        where: { isActive: true },
        select: {
          id: true,
          businessName: true,
          userId: true,
          financialProfileId: true,
        },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let payoutsExecuted = 0;
      for (const company of activeCompanies) {
        if (!company.userId) continue;

        try {
          const financialProfile = await this.prisma.financialProfile.findFirst(
            {
              where: {
                OR: [
                  { userId: company.userId },
                  { id: company.financialProfileId || undefined },
                  { companies: { some: { id: company.id } } },
                ],
                isActive: true,
              },
              select: { id: true, walletId: true },
            },
          );

          if (!financialProfile?.walletId) continue;

          // Salvaguarda de Idempotência: Garante que este estabelecimento ainda não recebeu saque gratuito hoje
          const alreadyExecutedToday = await this.prisma.transaction.findFirst({
            where: {
              barberWalletId: financialProfile.walletId,
              type: TransactionType.WITHDRAWAL,
              asaasFee: 0,
              createdAt: { gte: todayStart },
            },
          });

          if (alreadyExecutedToday) {
            this.logger.log(
              `[Cron Payouts] Empresa "${company.businessName}" já teve seu saque semanal processado hoje. Pulando.`,
            );
            continue;
          }

          const balance = await this.getCompanyBalance(company.userId);
          if (balance.availableBalance >= MIN_FREE_WEEKLY_PAYOUT) {
            const transferResult =
              await this.asaasService.transferSubaccountBalance(
                financialProfile.id,
                balance.availableBalance,
                { isFreeWeekly: true },
              );

            await this.prisma.transaction.create({
              data: {
                type: TransactionType.WITHDRAWAL,
                status: TransactionStatus.CONFIRMED,
                totalValue: balance.availableBalance,
                netValue: balance.availableBalance,
                platformFee: 0,
                asaasFee: 0,
                billingType: BillingType.PIX,
                barberWalletId: financialProfile.walletId,
                asaasPaymentId:
                  transferResult?.id ||
                  `payout_${Date.now()}_${company.id.slice(0, 6)}`,
              },
            });

            payoutsExecuted++;
            this.logger.log(
              `[Cron Payouts] Saque gratuito de R$ ${balance.availableBalance.toFixed(2)} executado para a empresa "${company.businessName}".`,
            );
          } else if (balance.availableBalance > 0) {
            this.logger.log(
              `[Cron Payouts] Empresa "${company.businessName}" possui saldo liberado de R$ ${balance.availableBalance.toFixed(2)}, inferior ao piso de gratuidade (R$ ${MIN_FREE_WEEKLY_PAYOUT.toFixed(2)}). O valor continuará acumulando.`,
            );
          }
        } catch (compError: any) {
          this.logger.error(
            `[Cron Payouts] Falha ao processar saque semanal da empresa #${company.id}: ${compError?.message || compError}`,
          );
        }
      }

      this.logger.log(
        `[Cron Payouts] Rotina finalizada: ${payoutsExecuted} saques automáticos gratuitos realizados.`,
      );
      return payoutsExecuted;
    } catch (err: any) {
      this.logger.error(
        `[Cron Payouts] Erro geral na rotina de saques semanais: ${err?.message || err}`,
      );
      return 0;
    }
  }
}
