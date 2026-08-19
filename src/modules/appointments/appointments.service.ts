import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAppointmentsDto } from './dto/appointments-create.dto';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import {
  AppointmentsSuperFiltersDto,
  AppointmentsAdminFiltersDto,
  AppointmentsFiltersDto,
} from './dto/appointments-filters.dto';
import { AppointmentsStatusUpdateDto } from './dto/appointements-update.dto';
import { ApptStatus, Role } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
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

    const endDate = new Date(data.appointmentDate);
    endDate.setMinutes(endDate.getMinutes() + service.durationMinutes);

    const expirationDate = new Date(Date.now() + 15 * 60000);
    // Verifica os agendamentos existentes no banco dentro desse bloco de tempo
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        companyId: data.companyId,
        serviceId: data.serviceId,
        isActive: true,
        status: { notIn: ['CANCELED'] },
        appointmentDate: {
          gte: new Date(data.appointmentDate),
          lt: endDate,
        },
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
    const downPayment = (price * service.downPaymentPercent) / 100;
    const platformFee =
      await this.calculateTax.calculatePlatformTaxPercentage(price);

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

  async getAppointmentByUserId(
    userId: string,
    filters?: AppointmentsFiltersDto,
  ) {
    const whereClause: any = {};
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

    if (!appointments) {
      throw new NotFoundException('Nenhum agendamento encontrado.');
    }

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
