import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  Prisma,
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
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

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
      throw new ConflictException(
        'Não foi possível concluir o cadastro com os dados informados.',
      );
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
    const sanitizedUser = {
      id: companyUser.id,
      name: companyUser.name,
      email: companyUser.email,
      phone: companyUser.phone,
      role: companyUser.role,
      createdAt: companyUser.createdAt,
      isActive: companyUser.isActive,
      companies: companyUser.companies,
    };

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
      user: sanitizedUser,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async getCompanyByCompanyId(
    companyId: string,
    userId?: string,
    role?: Role | string,
  ) {
    const isSystemManager = role === Role.ADMIN || role === Role.SUPER_ADMIN;

    const company = isSystemManager
      ? await this.prisma.company.findUnique({
          where: { id: companyId },
          include: {
            financialProfile: {
              select: {
                id: true,
                walletId: true,
                isActive: true,
              },
            },
          },
        })
      : userId
        ? await this.prisma.company.findFirst({
            where: { id: companyId, userId, isActive: true },
            include: {
              financialProfile: {
                select: {
                  id: true,
                  walletId: true,
                  isActive: true,
                },
              },
            },
          })
        : null;

    if (!company) {
      throw new NotFoundException('Nenhuma empresa encontrada para este ID.');
    }
    return company;
  }

  async createCompany(data: CreateCompanyWithoutUserDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const activeFinancialProfile = await this.prisma.financialProfile.findFirst(
      {
        where: { userId: userId, isActive: true },
        select: { id: true },
      },
    );

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
        financialProfileId: activeFinancialProfile?.id || null,
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

  async getCompanyByUserId(userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId, isActive: true },
      include: {
        financialProfile: {
          select: {
            id: true,
            walletId: true,
            isActive: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    if (!company.financialProfile) {
      const activeProfile = await this.prisma.financialProfile.findFirst({
        where: { userId: userId, isActive: true },
        select: {
          id: true,
          walletId: true,
          isActive: true,
        },
      });

      if (activeProfile) {
        await this.prisma.company.update({
          where: { id: company.id },
          data: { financialProfileId: activeProfile.id },
        });

        return {
          ...company,
          financialProfileId: activeProfile.id,
          financialProfile: activeProfile,
        };
      }
    }

    return company;
  }

  async getAllCompaniesByUserId(userId: string, filters?: FilterCompanyDto) {
    const whereClause: any = { userId: userId, isActive: true };
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
      include: {
        financialProfile: {
          select: {
            id: true,
            walletId: true,
            isActive: true,
          },
        },
      },
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
    let company: {
      id: string;
      businessName: string;
      slug: string;
      userId?: string;
    } | null = null;

    if (dto?.companyId) {
      company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, isActive: true },
        select: { id: true, businessName: true, slug: true, userId: true },
      });
      if (!company) {
        throw new NotFoundException('Estabelecimento não encontrado.');
      }
      if (userRole !== Role.ADMIN && userRole !== Role.SUPER_ADMIN) {
        if (company.userId !== userId) {
          throw new ForbiddenException(
            'Você não tem permissão para acessar os dados deste estabelecimento.',
          );
        }
      }
    } else {
      if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) {
        throw new BadRequestException(
          'Informe o companyId para consultar as métricas do estabelecimento.',
        );
      }
      company = await this.prisma.company.findFirst({
        where: { userId, isActive: true },
        select: { id: true, businessName: true, slug: true, userId: true },
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
    let completedDepositsNet = 0;
    let escrowLockedBalance = 0;

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
          // completedDepositsNet sum removed
          break;
        case ApptStatus.CONFIRMED:
          confirmedCount++;
          totalDownPaymentCollected += downPayment;
          totalPlatformFees += platformFee;
          // escrowLockedBalance sum removed
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

    const completedTxAgg = await this.prisma.transaction.aggregate({
      where: {
        appointment: {
          companyId: company.id,
          isActive: true,
          status: ApptStatus.COMPLETED,
        },
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.CONFIRMED,
      },
      _sum: { netValue: true },
    });
    completedDepositsNet = Number(completedTxAgg._sum.netValue || 0);

    const escrowTxAgg = await this.prisma.transaction.aggregate({
      where: {
        appointment: {
          companyId: company.id,
          isActive: true,
          status: ApptStatus.CONFIRMED,
        },
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.CONFIRMED,
      },
      _sum: { netValue: true },
    });
    escrowLockedBalance = Number(escrowTxAgg._sum.netValue || 0);

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

    // Busca saldo oficial consolidado da empresa (harmonizado com getCompanyBalance)
    let availableBalance = 0;
    let totalWithdrawn = 0;
    try {
      const balanceData = await this.getCompanyBalance(userId);
      availableBalance = balanceData.availableBalance;
      escrowLockedBalance = balanceData.escrowLockedBalance;
      totalWithdrawn = balanceData.totalWithdrawn;
    } catch {
      // Se não possui perfil financeiro configurado, saldos permanecem 0
      availableBalance = 0;
    }

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
   * Helper privado para cálculo centralizado de saldo disponível, custódia e saques (WP-03 / A4 / A14).
   */
  private async computeAvailableBalance(
    companyId: string,
    walletId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    const [completedAgg, escrowAgg, withdrawalsAgg] = await Promise.all([
      client.transaction.aggregate({
        where: {
          appointment: {
            companyId: companyId,
            isActive: true,
            status: ApptStatus.COMPLETED,
          },
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.CONFIRMED,
        },
        _sum: { netValue: true },
      }),
      client.transaction.aggregate({
        where: {
          appointment: {
            companyId: companyId,
            isActive: true,
            status: ApptStatus.CONFIRMED,
          },
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.CONFIRMED,
        },
        _sum: { netValue: true },
      }),
      client.transaction.aggregate({
        where: {
          barberWalletId: walletId,
          type: TransactionType.WITHDRAWAL,
          status: {
            in: [TransactionStatus.CONFIRMED, TransactionStatus.PENDING],
          },
        },
        _sum: { totalValue: true },
      }),
    ]);

    const completedNetRevenue = Number(completedAgg._sum.netValue || 0);
    const escrowLockedBalance = Number(escrowAgg._sum.netValue || 0);
    const totalWithdrawn = Number(withdrawalsAgg._sum.totalValue || 0);
    const availableBalance = Math.max(
      0,
      Number((completedNetRevenue - totalWithdrawn).toFixed(2)),
    );

    return {
      completedNetRevenue: Number(completedNetRevenue.toFixed(2)),
      escrowLockedBalance: Number(escrowLockedBalance.toFixed(2)),
      totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
      availableBalance: Number(availableBalance.toFixed(2)),
    };
  }

  /**
   * Consulta o saldo detalhado da empresa: disponível, em custódia (Escrow Hold) e histórico de saques.
   */
  async getCompanyBalance(userId: string, companyId?: string) {
    const whereClause: Prisma.CompanyWhereInput = {
      userId,
      isActive: true,
    };
    if (companyId) {
      whereClause.id = companyId;
    }

    const company = await this.prisma.company.findFirst({
      where: whereClause,
      select: { id: true, businessName: true, financialProfileId: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Estabelecimento não encontrado para este usuário.',
      );
    }

    const orConditions: Prisma.FinancialProfileWhereInput[] = [
      { userId },
      { companies: { some: { id: company.id } } },
    ];
    if (company.financialProfileId) {
      orConditions.push({ id: company.financialProfileId });
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: orConditions,
        isActive: true,
      },
      select: {
        id: true,
        walletId: true,
        pixAddressKey: true,
        pixAddressKeyType: true,
      },
    });

    if (
      !financialProfile?.walletId ||
      !financialProfile?.pixAddressKey ||
      !financialProfile?.pixAddressKeyType
    ) {
      throw new BadRequestException(
        'Estabelecimento não possui perfil financeiro ou subconta Asaas configurada.',
      );
    }

    const balanceMetrics = await this.computeAvailableBalance(
      company.id,
      financialProfile.walletId,
    );

    const nowLocal = toZonedTime(new Date(), 'America/Sao_Paulo');
    const daysUntilMonday = (1 + 7 - nowLocal.getDay()) % 7 || 7;
    const nextMondayLocal = new Date(nowLocal);
    nextMondayLocal.setDate(nowLocal.getDate() + daysUntilMonday);
    const y = nextMondayLocal.getFullYear();
    const m = (nextMondayLocal.getMonth() + 1).toString().padStart(2, '0');
    const d = nextMondayLocal.getDate().toString().padStart(2, '0');
    const nextMondayInstant = fromZonedTime(
      `${y}-${m}-${d}T06:00:00.000`,
      'America/Sao_Paulo',
    );

    return {
      companyId: company.id,
      businessName: company.businessName,
      walletId: financialProfile.walletId,
      availableBalance: balanceMetrics.availableBalance,
      escrowLockedBalance: balanceMetrics.escrowLockedBalance,
      completedNetRevenue: balanceMetrics.completedNetRevenue,
      totalWithdrawn: balanceMetrics.totalWithdrawn,
      nextFreeWithdrawalDate: nextMondayInstant.toISOString(),
      instantTransferFee: await this.asaasService.getTransferFee(),
      minFreeWeeklyPayoutThreshold: MIN_FREE_WEEKLY_PAYOUT,
      eligibleForFreeWeeklyPayout:
        balanceMetrics.availableBalance >= MIN_FREE_WEEKLY_PAYOUT,
    };
  }

  /**
   * Solicita saque avulso sob demanda fora do ciclo semanal com proteção atômica anti-race condition e dedução de tarifa.
   */
  async requestInstantWithdrawal(
    userId: string,
    dto?: WithdrawDto,
    companyId?: string,
  ) {
    const whereClause: Prisma.CompanyWhereInput = {
      userId,
      isActive: true,
    };
    if (companyId) {
      whereClause.id = companyId;
    }

    const company = await this.prisma.company.findFirst({
      where: whereClause,
      select: { id: true, businessName: true, financialProfileId: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Estabelecimento não encontrado para este usuário.',
      );
    }

    const orConditions: Prisma.FinancialProfileWhereInput[] = [
      { userId },
      { companies: { some: { id: company.id } } },
    ];
    if (company.financialProfileId) {
      orConditions.push({ id: company.financialProfileId });
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: orConditions,
        isActive: true,
      },
      select: {
        id: true,
        walletId: true,
        pixAddressKey: true,
        pixAddressKeyType: true,
      },
    });

    if (
      !financialProfile?.walletId ||
      !financialProfile?.pixAddressKey ||
      !financialProfile?.pixAddressKeyType
    ) {
      throw new BadRequestException(
        'Estabelecimento não possui perfil financeiro ou subconta Asaas configurada.',
      );
    }

    const transferFee = await this.asaasService.getTransferFee();

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

      const balanceMetrics = await this.computeAvailableBalance(
        company.id,
        financialProfile.walletId,
        tx,
      );

      const currentAvailableBalance = balanceMetrics.availableBalance;

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
          platformAbsorbedFee: 0,
          paidByPlatform: false,
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
        escrowLockedBalance: balanceMetrics.escrowLockedBalance,
      };
    });

    // 2. Chamada à API de Transferência do Asaas (fora da transação de banco para evitar lock prolongado)
    let asaasResult: any = null;
    try {
      asaasResult = await this.asaasService.transferSubaccountBalance(
        financialProfile.id,
        netAmountTransferred,
        {
          isFreeWeekly: false,
          pixAddressKey: financialProfile.pixAddressKey,
          pixAddressKeyType: financialProfile.pixAddressKeyType,
        },
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
          asaasResult?.id || `with_${Date.now()}_${company.id.slice(0, 6)}`,
      },
    });

    return {
      message: 'Saque avulso solicitado com sucesso.',
      withdrawal: {
        id: confirmedTx.id,
        transactionId: confirmedTx.id,
        requestedAmount: requestedAmount,
        netAmountTransferred: netAmountTransferred,
        transferFee: transferFee,
        transferFeeDeducted: transferFee,
        remainingAvailableBalance: remainingBalance,
        escrowLockedBalance: escrowLockedBalance,
        status: confirmedTx.status,
        transferredAt: confirmedTx.createdAt,
        destinationPixKey: financialProfile.pixAddressKey,
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

    const orConditions: Prisma.FinancialProfileWhereInput[] = [
      { userId },
      { companies: { some: { id: company.id } } },
    ];
    if (company.financialProfileId) {
      orConditions.push({ id: company.financialProfileId });
    }

    const financialProfile = await this.prisma.financialProfile.findFirst({
      where: {
        OR: orConditions,
        isActive: true,
      },
      select: {
        walletId: true,
        pixAddressKey: true,
        pixAddressKeyType: true,
      },
    });

    if (
      !financialProfile?.walletId ||
      !financialProfile?.pixAddressKey ||
      !financialProfile?.pixAddressKeyType
    ) {
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
  @Cron('0 6 * * 1', { timeZone: 'America/Sao_Paulo' })
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
          financialProfile: {
            select: {
              id: true,
              walletId: true,
              pixAddressKey: true,
              pixAddressKeyType: true,
              isActive: true,
            },
          },
        },
      });

      const now = new Date();
      const todayStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      );

      let payoutsExecuted = 0;
      for (const company of activeCompanies) {
        if (!company.userId) continue;

        try {
          const financialProfile =
            company.financialProfile && company.financialProfile.isActive
              ? company.financialProfile
              : await this.prisma.financialProfile.findFirst({
                  where: {
                    OR: [
                      { userId: company.userId },
                      { companies: { some: { id: company.id } } },
                    ],
                    isActive: true,
                  },
                  select: {
                    id: true,
                    walletId: true,
                    pixAddressKey: true,
                    pixAddressKeyType: true,
                  },
                });

          if (!financialProfile?.walletId) continue;

          // Salvaguarda de Idempotência: Garante que este estabelecimento não possui saque em voo ou executado hoje
          const alreadyExecutedToday = await this.prisma.transaction.findFirst({
            where: {
              barberWalletId: financialProfile.walletId,
              type: TransactionType.WITHDRAWAL,
              status: {
                in: [TransactionStatus.CONFIRMED, TransactionStatus.PENDING],
              },
              createdAt: { gte: todayStart },
            },
          });

          if (alreadyExecutedToday) {
            this.logger.log(
              `[Cron Payouts] Empresa "${company.businessName}" já possui saque registrado hoje. Pulando.`,
            );
            continue;
          }

          const balance = await this.computeAvailableBalance(
            company.id,
            financialProfile.walletId,
          );

          if (balance.availableBalance >= MIN_FREE_WEEKLY_PAYOUT) {
            // 1. Reserva Atômica Local com status PENDING (proteção anti-race condition)
            const pendingTx = await this.prisma.transaction.create({
              data: {
                type: TransactionType.WITHDRAWAL,
                status: TransactionStatus.PENDING,
                totalValue: balance.availableBalance,
                netValue: balance.availableBalance,
                platformFee: 0,
                asaasFee: 0,
                platformAbsorbedFee: 0,
                paidByPlatform: true,
                billingType: BillingType.PIX,
                barberWalletId: financialProfile.walletId,
              },
            });

            // 2. Chamada Externa de Transferência ao Gateway Asaas
            try {
              const transferResult =
                await this.asaasService.transferSubaccountBalance(
                  financialProfile.id,
                  balance.availableBalance,
                  {
                    isFreeWeekly: true,
                    pixAddressKey: financialProfile.pixAddressKey || undefined,
                    pixAddressKeyType:
                      financialProfile.pixAddressKeyType || undefined,
                  },
                );

              // 3. Sucesso: Confirma a transação no banco
              await this.prisma.transaction.update({
                where: { id: pendingTx.id },
                data: {
                  status: TransactionStatus.CONFIRMED,
                  asaasPaymentId:
                    transferResult?.id ||
                    `payout_${Date.now()}_${company.id.slice(0, 6)}`,
                },
              });

              payoutsExecuted++;
              this.logger.log(
                `[Cron Payouts] Saque gratuito de R$ ${balance.availableBalance.toFixed(2)} executado para a empresa "${company.businessName}".`,
              );
            } catch (transferErr: any) {
              this.logger.error(
                `[Cron Payouts] Falha na transferência Asaas para empresa #${company.id}: ${transferErr?.message || transferErr}. Revertendo reserva de saldo...`,
              );
              await this.prisma.transaction.update({
                where: { id: pendingTx.id },
                data: { status: TransactionStatus.CANCELED },
              });
            }
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
