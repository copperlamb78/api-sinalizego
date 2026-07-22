import {
  BadRequestException,
  ConflictException,
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

    const provider = await this.prisma.provider.findFirst({
      where: { id: data.providerId },
    });

    if (!provider) {
      throw new NotFoundException('Negócio não encontrado.');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    if (service.providerId !== provider.id) {
      throw new BadRequestException('O serviço não pertence a este negócio.');
    }

    const startDate = new Date(data.appointmentDate);

    const endDate = new Date(data.appointmentDate);
    endDate.setMinutes(endDate.getMinutes() + service.durationMinutes);

    const expirationDate = new Date(Date.now() + 15 * 60000);
    // Verifica os agendamentos existentes no banco dentro desse bloco de tempo
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        providerId: data.providerId,
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
    // é maior ou igual a quantidade de empreados disponíveis
    if (existingAppointments.length >= service.availableEmployers) {
      throw new ConflictException(
        'Não há vagas disponíveis para este serviço neste horário',
      );
    }

    const price = service.totalPrice;
    const downPayment = (price * service.downPaymentPercent) / 100;
    const platformFee = await this.calculateTax.calculatePlatformTax(price);

    const appointment = await this.prisma.appointment.create({
      data: {
        providerId: provider.id,
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
  //Futuramente essa rota vai usar roleGuard (superAdmin)
  async getAppointments(filters?: AppointmentsSuperFiltersDto) {
    const whereClause: any = {};
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.providerId) whereClause.providerId = filters.providerId;
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
  //Futuramente essa rota vai usar roleGuard (admin)
  async getAppointmentByProviderId(
    userId: string,
    filters?: AppointmentsAdminFiltersDto,
  ) {
    const whereClause: any = {};
    let orderByClause: any = { createdAt: 'desc' };
    if (filters) {
      if (filters.providerId) whereClause.providerId = filters.providerId;
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

  async updateAppointmentStatus(appointmentId: string, status: any) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
    });

    return updatedAppointment;
  }

  //implementar service de soft-delete
}
