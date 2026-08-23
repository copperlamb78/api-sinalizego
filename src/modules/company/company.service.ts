import {
  BadRequestException,
  ConflictException,
  Injectable,
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
import { ApptStatus, Role } from '@prisma/client';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slugHelper: SlugHelper,
    private readonly authService: AuthService,
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
        serviceId: true,
        service: {
          select: {
            id: true,
            name: true,
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
    let pendingPaymentCount = 0;

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
        case ApptStatus.CANCELED:
          canceledCount++;
          break;
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
    const validCount = completedCount + confirmedCount + canceledCount;
    const completionRate =
      validCount > 0
        ? Number(((completedCount / validCount) * 100).toFixed(2))
        : 0;

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
    }));

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
      },
      volume: {
        total: totalAppointments,
        completed: completedCount,
        confirmed: confirmedCount,
        canceled: canceledCount,
        pendingPayment: pendingPaymentCount,
        completionRate,
      },
      topServices,
      upcomingToday,
    };
  }
}
