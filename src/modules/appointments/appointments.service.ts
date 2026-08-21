import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAppointmentsDto } from './dto/appointments-create.dto';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import { CalculateDeposit } from 'src/helpers/calculate-deposit.helper';
import {
  AppointmentsSuperFiltersDto,
  AppointmentsAdminFiltersDto,
  AppointmentsFiltersDto,
} from './dto/appointments-filters.dto';
import { AppointmentsStatusUpdateDto } from './dto/appointements-update.dto';
import { ApptStatus, Role } from '@prisma/client';
import { AsaasService } from 'src/asaas/asaas.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
    private readonly calculateDeposit: CalculateDeposit,
    private readonly asaasService: AsaasService,
  ) {}

  async createAppointment(data: CreateAppointmentsDto, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (!user.cpfCnpj) {
      throw new BadRequestException('Usuário não possui CPF/CNPJ.');
    }

    // Camada de Segurança Anti-DoS: Máximo de 3 agendamentos PENDING_PAYMENT ativos por cliente
    const activePendingCount = await this.prisma.appointment.count({
      where: {
        clientId: user.id,
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (activePendingCount >= 3) {
      throw new BadRequestException(
        'Você já possui 3 agendamentos pendentes de pagamento. Conclua o pagamento ou aguarde a expiração para criar novas reservas.',
      );
    }

    const company = await this.prisma.company.findFirst({
      where: { id: data.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId },
      include: { serviceGroup: true },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    if (service.companyId !== company.id) {
      throw new BadRequestException('O serviço não pertence a esta empresa.');
    }

    const startDate = new Date(data.appointmentDate);

    const endDate = new Date(data.appointmentDate);
    endDate.setMinutes(endDate.getMinutes() + service.durationMinutes);

    const expirationDate = new Date(Date.now() + 15 * 60000);

    // Verifica agendamentos válidos dentro desse bloco de tempo (exclui reservas PENDING_PAYMENT já expiradas)
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        companyId: data.companyId,
        serviceId: data.serviceId,
        isActive: true,
        status: { notIn: [ApptStatus.CANCELED] },
        appointmentDate: {
          gte: new Date(data.appointmentDate),
          lt: endDate,
        },
        OR: [
          { status: { not: ApptStatus.PENDING_PAYMENT } },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    // Verifica se a quantidade de serviços dentro desse bloco de tempo
    // é maior ou igual a quantidade de vagas disponíveis no grupo de serviços
    const maxCapacity = service.serviceGroup?.capacity ?? 1;
    if (existingAppointments.length >= maxCapacity) {
      throw new ConflictException(
        'Não há vagas disponíveis para este serviço neste horário',
      );
    }

    const price = service.totalPrice;
    const downPayment = this.calculateDeposit.calculateDeposit(
      price,
      service.downPaymentPercent,
      data.downPaymentPercent,
    );
    const platformFee = this.calculateTax.calculatePlatformTax(price);

    const appointment = await this.prisma.appointment.create({
      data: {
        companyId: company.id,
        serviceId: service.id,
        clientId: user.id,
        appointmentDate: startDate,
        appointmentEndDate: endDate,
        expiresAt: expirationDate,
        servicePrice: price,
        downPaymentAmount: downPayment,
        platformFeeAmount: platformFee,
      },
    });

    return appointment;
  }

  /**
   * Cron Job executado a cada minuto para cancelar agendamentos pendentes expirados
   * e liberar o horário cancelando a cobrança no gateway Asaas.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredAppointments(): Promise<number> {
    const now = new Date();
    const expiredAppointments = await this.prisma.appointment.findMany({
      where: {
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: { lt: now },
      },
      include: {
        transactions: true,
      },
    });

    if (expiredAppointments.length === 0) {
      return 0;
    }

    this.logger.log(
      `Processando ${expiredAppointments.length} agendamento(s) expirado(s)...`,
    );

    let canceledCount = 0;

    for (const appt of expiredAppointments) {
      try {
        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: {
            status: ApptStatus.CANCELED,
            isActive: false,
          },
        });

        if (appt.transactions && appt.transactions.length > 0) {
          for (const tx of appt.transactions) {
            if (tx.asaasPaymentId && tx.status === 'PENDING') {
              await this.asaasService.cancelPayment(tx.asaasPaymentId);
              await this.prisma.transaction.update({
                where: { id: tx.id },
                data: { status: 'CANCELED' },
              });
            }
          }
        }

        canceledCount++;
      } catch (error: any) {
        this.logger.error(
          `Erro ao processar expiração do agendamento #${appt.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `${canceledCount} agendamento(s) expirado(s) cancelado(s) com sucesso.`,
    );

    return canceledCount;
  }

  async getAppointments(filters?: AppointmentsSuperFiltersDto) {
    const whereClause: any = {};
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.companyId) whereClause.companyId = filters.companyId;
      if (filters.clientId) whereClause.clientId = filters.clientId;
      if (filters.serviceId) whereClause.serviceId = filters.serviceId;
      if (filters.status) whereClause.status = filters.status;
      if (filters.startDate)
        whereClause.appointmentDate = { gte: new Date(filters.startDate) };
      if (filters.endDate)
        whereClause.appointmentEndDate = { lte: new Date(filters.endDate) };
      if (filters.servicePrice)
        whereClause.servicePrice = { gte: filters.servicePrice };
      if (filters.downPaymentAmount)
        whereClause.downPaymentAmount = { gte: filters.downPaymentAmount };
      if (filters.platformFeeAmount)
        whereClause.platformFeeAmount = { gte: filters.platformFeeAmount };
      if (filters.isActive !== undefined)
        whereClause.isActive = filters.isActive;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const appointments = await this.prisma.appointment.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    if (!appointments) {
      throw new NotFoundException('Nenhum agendamento encontrado.');
    }

    return appointments;
  }

  async getAppointmentByCompanyId(
    userId: string,
    filters?: AppointmentsAdminFiltersDto,
  ) {
    const userCompanies = await this.prisma.company.findMany({
      where: { userId },
      select: { id: true },
    });

    const companyIds = userCompanies.map((company) => company.id);

    if (companyIds.length === 0) {
      return [];
    }

    const whereClause: any = {};

    if (filters?.companyId) {
      if (!companyIds.includes(filters.companyId)) {
        throw new ForbiddenException(
          'Você não tem permissão para acessar os agendamentos desta empresa.',
        );
      }
      whereClause.companyId = filters.companyId;
    } else {
      whereClause.companyId = { in: companyIds };
    }

    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.clientId) whereClause.clientId = filters.clientId;
      if (filters.serviceId) whereClause.serviceId = filters.serviceId;
      if (filters.status) whereClause.status = filters.status;
      if (filters.startDate)
        whereClause.appointmentDate = { gte: new Date(filters.startDate) };
      if (filters.endDate)
        whereClause.appointmentEndDate = { lte: new Date(filters.endDate) };
      if (filters.servicePrice)
        whereClause.servicePrice = { gte: filters.servicePrice };
      if (filters.downPaymentAmount)
        whereClause.downPaymentAmount = { gte: filters.downPaymentAmount };
      if (filters.isActive !== undefined)
        whereClause.isActive = filters.isActive;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const appointments = await this.prisma.appointment.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    return appointments;
  }

  async getAppointmentByUserId(
    userId: string,
    filters?: AppointmentsFiltersDto,
  ) {
    const whereClause: any = { clientId: userId };
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.serviceId) whereClause.serviceId = filters.serviceId;
      if (filters.startDate)
        whereClause.appointmentDate = { gte: new Date(filters.startDate) };
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const appointments = await this.prisma.appointment.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    return appointments;
  }

  async updateAppointmentStatus(
    appointmentId: string,
    userId: string,
    dto: AppointmentsStatusUpdateDto,
  ) {
    if (
      dto.status === ApptStatus.CONFIRMED ||
      (dto.status as string) === 'CONFIRMED'
    ) {
      throw new BadRequestException(
        'A confirmação de agendamento é exclusiva do processamento automático de pagamento via Webhook.',
      );
    }

    if (
      dto.status === ApptStatus.PENDING_PAYMENT ||
      (dto.status as string) === 'PENDING_PAYMENT'
    ) {
      throw new BadRequestException(
        'Não é permitido alterar o status manualmente para aguardando pagamento.',
      );
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        company: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const isCompanyOwner = appointment.company.userId === userId;

    if (!isSystemManager && !isCompanyOwner) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar o status deste agendamento.',
      );
    }

    if (appointment.status === ApptStatus.CANCELED) {
      throw new BadRequestException(
        'Não é possível alterar o status de um agendamento já cancelado.',
      );
    }

    if (dto.status === ApptStatus.COMPLETED) {
      if (appointment.status !== ApptStatus.CONFIRMED) {
        throw new BadRequestException(
          'Apenas agendamentos confirmados podem ser marcados como concluídos.',
        );
      }

      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: ApptStatus.COMPLETED },
      });
    }

    if (dto.status === ApptStatus.CANCELED) {
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: ApptStatus.CANCELED,
          isActive: false,
          disabledAt: new Date(),
          disabledBy: user.id,
        },
      });
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: dto.status },
    });
  }

  async deactivateAppointment(appointmentId: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        company: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const isCompanyOwner = appointment.company?.userId === userId;
    const isClientOwner = appointment.clientId === userId;

    if (!isSystemManager && !isCompanyOwner && !isClientOwner) {
      throw new ForbiddenException(
        'Você não tem permissão para cancelar este agendamento.',
      );
    }

    if (appointment.status === 'CANCELED' || !appointment.isActive) {
      throw new BadRequestException('Agendamento já está inativo.');
    }

    const canceledAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELED',
        isActive: false,
        disabledAt: new Date(),
        disabledBy: user.id,
      },
    });

    return canceledAppointment;
  }
}
