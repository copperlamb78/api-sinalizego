import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import { AvailabilityService } from './availability.service';
import { MailService } from '../mail/mail.service';
import { TransactionStatus } from '@prisma/client';
import {
  MAX_ACTIVE_APPOINTMENTS_PER_CLIENT,
  MAX_WEEKLY_CANCELLATIONS_LIMIT,
} from 'src/common/constants/billing.constant';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
    private readonly calculateDeposit: CalculateDeposit,
    private readonly asaasService: AsaasService,
    private readonly availabilityService: AvailabilityService,
    private readonly mailService: MailService,
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
    if (isNaN(startDate.getTime()) || startDate <= new Date()) {
      throw new BadRequestException(
        'A data do agendamento deve ser uma data futura.',
      );
    }

    const endDate = new Date(
      startDate.getTime() + service.durationMinutes * 60000,
    );
    const expirationDate = new Date(Date.now() + 15 * 60000);

    // Validação de Expediente: garante que o agendamento está dentro do horário de funcionamento e fora do almoço
    await this.availabilityService.validateSlotWithinWorkingHours(
      company.id,
      startDate,
      endDate,
    );

    const price = Number(service.totalPrice);
    const downPayment = this.calculateDeposit.calculateDeposit(
      price,
      service.downPaymentPercent,
    );
    const platformFee = this.calculateTax.calculatePlatformTax(downPayment);

    // Proteção Anti-Race Condition: atomicidade serializada com lock pessimista na linha do usuário
    const appointment = await this.prisma.$transaction(async (tx) => {
      // 1. Lock pessimista na linha do usuário para serializar requisições concorrentes e evitar bypass de limites
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      const now = new Date();

      // 2. Trava de Segurança Anti-Abuso: Bloqueio temporário para contas com cancelamento excessivo (>= 3 na mesma semana) disparados pelo cliente
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weeklyCancellationsCount = await tx.appointment.count({
        where: {
          clientId: user.id,
          status: ApptStatus.CANCELED,
          disabledBy: user.id,
          OR: [
            { disabledAt: { gte: sevenDaysAgo } },
            { updatedAt: { gte: sevenDaysAgo } },
          ],
        },
      });

      if (weeklyCancellationsCount >= MAX_WEEKLY_CANCELLATIONS_LIMIT) {
        throw new HttpException(
          `Sua conta atingiu o limite de ${MAX_WEEKLY_CANCELLATIONS_LIMIT} cancelamentos nesta semana. Por motivos de segurança e prevenção de abusos, novos agendamentos estão temporariamente bloqueados.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 3. Trava de Concorrência & Anti-DoS: Limite de no máximo 2 agendamentos ativos simultâneos por cliente (ativo até o término do corte)
      const activeAppointmentsCount = await tx.appointment.count({
        where: {
          clientId: user.id,
          isActive: true,
          OR: [
            {
              status: ApptStatus.PENDING_PAYMENT,
              expiresAt: { gt: now },
            },
            {
              status: ApptStatus.CONFIRMED,
              appointmentEndDate: { gt: now },
            },
          ],
        },
      });

      if (activeAppointmentsCount >= MAX_ACTIVE_APPOINTMENTS_PER_CLIENT) {
        throw new BadRequestException(
          `Você atingiu o limite de ${MAX_ACTIVE_APPOINTMENTS_PER_CLIENT} agendamentos ativos simultâneos. Conclua ou aguarde a realização dos seus agendamentos para criar novas reservas.`,
        );
      }

      const maxCapacity = service.serviceGroup?.capacity ?? 1;

      // Consulta de sobreposição canônica de intervalos:
      // Intervalo A colide com B se (A.start < B.end) E (A.end > B.start)
      // Agrupado pelo serviceGroupId para compartilhar capacidade entre serviços da mesma categoria/cadeira
      const existingAppointments = await tx.appointment.findMany({
        where: {
          companyId: data.companyId,
          isActive: true,
          status: { notIn: [ApptStatus.CANCELED] },
          appointmentDate: { lt: endDate },
          appointmentEndDate: { gt: startDate },
          service: {
            serviceGroupId: service.serviceGroupId,
          },
          OR: [
            { status: { not: ApptStatus.PENDING_PAYMENT } },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (existingAppointments.length >= maxCapacity) {
        throw new ConflictException(
          'Não há vagas disponíveis para este serviço neste horário',
        );
      }

      return tx.appointment.create({
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
    });

    return appointment;
  }

  /**
   * Cron Job executado a cada minuto para cancelar agendamentos pendentes expirados
   * e liberar o horário cancelando a cobrança no gateway Asaas.
   */
  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'America/Sao_Paulo' })
  async handleExpiredAppointments(): Promise<number> {
    try {
      const now = new Date();
      const expiredAppointments = await this.prisma.appointment.findMany({
        where: {
          status: ApptStatus.PENDING_PAYMENT,
          isActive: true,
          expiresAt: { lt: now },
        },
        select: {
          id: true,
          transactions: {
            where: { status: TransactionStatus.PENDING },
            select: { id: true, asaasPaymentId: true, status: true },
          },
        },
        orderBy: { expiresAt: 'asc' },
        take: 50,
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
    } catch (dbError: any) {
      this.logger.warn(
        `[Cron ExpiredAppointments] Banco de dados temporariamente inacessível: ${dbError?.message || dbError}`,
      );
      return 0;
    }
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
        client: {
          select: { id: true, name: true, email: true },
        },
        service: {
          select: {
            id: true,
            name: true,
            totalPrice: true,
            downPaymentPercent: true,
          },
        },
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

    // Regra de Cancelamento & Estorno (Conformidade CDC Art. 51 / Código Civil Arts. 417 a 420)
    const hoursDifference =
      (new Date(appointment.appointmentDate).getTime() - Date.now()) /
      (1000 * 60 * 60);

    let isRefunded = false;
    let refundAmount: number | undefined = undefined;
    let retainedDeposit: number | undefined = undefined;

    if (appointment.status === ApptStatus.CONFIRMED) {
      const transaction = await this.prisma.transaction.findFirst({
        where: {
          appointmentId: appointment.id,
          status: TransactionStatus.CONFIRMED,
        },
      });

      if (transaction?.asaasPaymentId) {
        const paidAmount = Number(appointment.downPaymentAmount);
        const totalPrice = Number(
          appointment.servicePrice || appointment.service?.totalPrice || 0,
        );
        const configuredFloor = appointment.service?.downPaymentPercent ?? 25;
        const guaranteedDepositAmount = this.calculateDeposit.calculateDeposit(
          totalPrice,
          configuredFloor,
        );

        if (hoursDifference > 24) {
          // 1. Cancelamento com antecedência (> 24h): Estorno integral (100% do valor pago online)
          try {
            await this.asaasService.refundPayment(
              transaction.asaasPaymentId,
              undefined,
              'Cancelamento com antecedência superior a 24 horas (estorno integral).',
            );
            await this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: TransactionStatus.REFUNDED },
            });
            isRefunded = true;
            refundAmount = paidAmount;
          } catch (err: any) {
            this.logger.error(
              `Falha ao processar estorno integral Asaas no cancelamento do agendamento #${appointment.id}: ${err?.message || err}`,
            );
          }
        } else {
          // 2. Cancelamento tardio (<= 24h):
          // O sinal mínimo de garantia é retido para compensação de vacância.
          retainedDeposit = guaranteedDepositAmount;

          // Se o cliente adiantou valor superior ao sinal mínimo (ex: 50%, 75% ou 100%), o excedente é estornado.
          if (paidAmount > guaranteedDepositAmount) {
            const excessToRefund = Number(
              (paidAmount - guaranteedDepositAmount).toFixed(2),
            );
            if (excessToRefund > 0) {
              try {
                await this.asaasService.refundPayment(
                  transaction.asaasPaymentId,
                  excessToRefund,
                  'Cancelamento tardio (<= 24h): estorno parcial do valor excedente ao sinal mínimo de garantia.',
                );
                await this.prisma.transaction.update({
                  where: { id: transaction.id },
                  data: { status: TransactionStatus.REFUNDED },
                });
                isRefunded = true;
                refundAmount = excessToRefund;
              } catch (err: any) {
                this.logger.error(
                  `Falha ao processar estorno parcial Asaas no cancelamento tardio do agendamento #${appointment.id}: ${err?.message || err}`,
                );
              }
            }
          }
        }
      }
    }

    const canceledAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELED',
        retainedDepositAmount:
          retainedDeposit !== undefined ? retainedDeposit : null,
        isActive: false,
        disabledAt: new Date(),
        disabledBy: user.id,
      },
    });

    // Disparo resiliente de e-mail de cancelamento
    if (appointment.client?.email) {
      this.mailService
        .sendAppointmentCancellationEmail(appointment.client.email, {
          customerName: appointment.client.name,
          companyName: appointment.company?.businessName || 'Estabelecimento',
          serviceName: appointment.service?.name || 'Serviço',
          appointmentDate: appointment.appointmentDate,
          isRefunded,
          refundAmount,
          timezone: appointment.company?.timezone,
        })
        .catch(() => {});
    }

    return canceledAppointment;
  }

  async completeAppointment(appointmentId: string, userId: string) {
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

    if (!isSystemManager && !isCompanyOwner) {
      throw new ForbiddenException(
        'Você não tem permissão para concluir este agendamento.',
      );
    }

    if (appointment.status === ApptStatus.COMPLETED) {
      throw new BadRequestException(
        'Este agendamento já foi concluído anteriormente.',
      );
    }

    if (appointment.status === ApptStatus.CANCELED) {
      throw new BadRequestException(
        'Não é possível concluir um agendamento cancelado.',
      );
    }

    if (appointment.status === ApptStatus.NO_SHOW) {
      throw new BadRequestException(
        'Não é possível concluir um agendamento que foi registrado como falta (No-Show).',
      );
    }

    if (appointment.status === ApptStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Não é possível concluir um agendamento que ainda não foi confirmado via pagamento.',
      );
    }

    if (appointment.status !== ApptStatus.CONFIRMED) {
      throw new BadRequestException(
        'Apenas agendamentos confirmados podem ser marcados como concluídos.',
      );
    }

    // Trava Temporal: Não permitir conclusão antes do início do agendamento
    if (new Date() < appointment.appointmentDate) {
      throw new BadRequestException(
        'Não é possível concluir um atendimento antes do horário de início agendado.',
      );
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: ApptStatus.COMPLETED },
      include: {
        company: {
          select: {
            id: true,
            businessName: true,
            slug: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            totalPrice: true,
            durationMinutes: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Registra a falta do cliente (No-Show) com retenção legal do sinal de garantia para o estabelecimento.
   */
  async markAsNoShow(appointmentId: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        company: true,
        service: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
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

    if (!isSystemManager && !isCompanyOwner) {
      throw new ForbiddenException(
        'Você não tem permissão para registrar falta neste agendamento.',
      );
    }

    if (appointment.status === ApptStatus.NO_SHOW) {
      throw new BadRequestException(
        'Este agendamento já foi registrado como falta (No-Show).',
      );
    }

    if (appointment.status === ApptStatus.COMPLETED) {
      throw new BadRequestException(
        'Não é possível marcar como falta um agendamento já concluído.',
      );
    }

    if (appointment.status === ApptStatus.CANCELED) {
      throw new BadRequestException(
        'Não é possível marcar como falta um agendamento já cancelado.',
      );
    }

    if (appointment.status === ApptStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Não é possível registrar falta para um agendamento com pagamento pendente.',
      );
    }

    if (appointment.status !== ApptStatus.CONFIRMED) {
      throw new BadRequestException(
        'Apenas agendamentos confirmados podem ser registrados como falta (No-Show).',
      );
    }

    const now = new Date();
    // Trava Temporal: Tolerância de 15 minutos após o horário agendado
    const minAllowedTime = new Date(
      appointment.appointmentDate.getTime() + 15 * 60 * 1000,
    );
    if (now < minAllowedTime) {
      throw new BadRequestException(
        'O registro de falta (No-Show) só é permitido após o início do horário agendado (com tolerância mínima de 15 minutos).',
      );
    }

    const retainedDeposit = Number(appointment.downPaymentAmount || 0);

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: ApptStatus.NO_SHOW,
        retainedDepositAmount: retainedDeposit,
        disabledAt: now,
        disabledBy: user.id,
      },
      include: {
        company: {
          select: {
            id: true,
            businessName: true,
            slug: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            totalPrice: true,
            durationMinutes: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Cron Job diário às 19:00 para envio de lembretes aos clientes com agendamento no dia seguinte (D-1).
   */
  @Cron('0 19 * * *', { timeZone: 'America/Sao_Paulo' })
  async sendDailyAppointmentReminders(): Promise<number> {
    try {
      const now = new Date();
      const tomorrowStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0,
          0,
          0,
          0,
        ),
      );
      const tomorrowEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          23,
          59,
          59,
          999,
        ),
      );

      const appointments = await this.prisma.appointment.findMany({
        where: {
          status: ApptStatus.CONFIRMED,
          isActive: true,
          appointmentDate: {
            gte: tomorrowStart,
            lte: tomorrowEnd,
          },
        },
        orderBy: { appointmentDate: 'asc' },
        include: {
          client: {
            select: {
              name: true,
              email: true,
            },
          },
          company: {
            select: {
              businessName: true,
              street: true,
              number: true,
              district: true,
              city: true,
              state: true,
              timezone: true,
            },
          },
          service: {
            select: {
              name: true,
            },
          },
        },
      });

      let sentCount = 0;
      for (const appt of appointments) {
        if (!appt.client?.email) continue;
        try {
          const address = `${appt.company.street}, ${appt.company.number} - ${appt.company.district}, ${appt.company.city}/${appt.company.state}`;
          const sent = await this.mailService.sendAppointmentReminderEmail(
            appt.client.email,
            {
              customerName: appt.client.name,
              companyName: appt.company.businessName,
              serviceName: appt.service.name,
              appointmentDate: appt.appointmentDate,
              address,
              timezone: appt.company.timezone,
            },
          );
          if (sent) sentCount++;
        } catch (err: any) {
          this.logger.error(
            `Falha ao enviar lembrete D-1 para agendamento #${appt.id}: ${err?.message || err}`,
          );
        }
      }

      this.logger.log(
        `[Cron Lembrete D-1] ${sentCount} lembretes de agendamento enviados com sucesso.`,
      );
      return sentCount;
    } catch (dbError: any) {
      this.logger.warn(
        `[Cron Lembrete D-1] Banco de dados temporariamente inacessível: ${dbError?.message || dbError}`,
      );
      return 0;
    }
  }

  /**
   * Cron Job horário para auto-concluir agendamentos confirmados cujo término ocorreu há mais de 24h.
   * Libera automaticamente o saldo retido em custódia (Escrow Hold) caso o estabelecimento não tenha clicado manualmente.
   */
  @Cron(CronExpression.EVERY_HOUR, { timeZone: 'America/Sao_Paulo' })
  async autoCompletePastConfirmedAppointments(): Promise<number> {
    try {
      const pastThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const updateResult = await this.prisma.appointment.updateMany({
        where: {
          status: ApptStatus.CONFIRMED,
          isActive: true,
          appointmentEndDate: { lte: pastThreshold },
        },
        data: {
          status: ApptStatus.COMPLETED,
          disabledBy: 'SYSTEM_AUTO_COMPLETE',
        },
      });

      this.logger.log(
        `[Cron AutoComplete] ${updateResult.count} agendamentos passados concluídos automaticamente (custódia liberada).`,
      );

      return updateResult.count;
    } catch (err: any) {
      this.logger.warn(
        `[Cron AutoComplete] Erro ao auto-concluir agendamentos passados: ${err?.message || err}`,
      );
      return 0;
    }
  }
}
