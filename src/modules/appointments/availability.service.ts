import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApptStatus } from '@prisma/client';

export interface AvailableSlotsResponse {
  date: string;
  totalAvailable: number;
  slots: string[];
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Converte uma string "HH:mm" para o total de minutos desde a meia-noite.
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Converte minutos desde a meia-noite para uma string formatada "HH:mm".
   */
  private minutesToTime(minutesTotal: number): string {
    const hours = Math.floor(minutesTotal / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (minutesTotal % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Extrai o dia da semana (0 = Domingo a 6 = Sábado) a partir de uma data "YYYY-MM-DD".
   */
  private getDayOfWeekFromDateString(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Cria data em UTC ao meio-dia para evitar deslocamentos de fuso horário
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utcDate.getUTCDay();
  }

  /**
   * Obtém o expediente aplicável para uma data (considerando exceções/feriados prioritários).
   */
  private async resolveWorkingHoursForDate(companyId: string, dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDayUTC = new Date(
      Date.UTC(year, month - 1, day, 23, 59, 59, 999),
    );
    const dayOfWeek = this.getDayOfWeekFromDateString(dateStr);

    // ⚡ O-09: Paraleliza a busca de exceção e expediente padrão semanal
    const [exception, workingHour] = await Promise.all([
      this.prisma.scheduleException.findFirst({
        where: {
          companyId,
          isActive: true,
          date: {
            gte: startOfDayUTC,
            lte: endOfDayUTC,
          },
        },
      }),
      this.prisma.workingHour.findUnique({
        where: {
          companyId_dayOfWeek: {
            companyId,
            dayOfWeek,
          },
        },
      }),
    ]);

    if (exception) {
      if (exception.isClosed) {
        return null; // Totalmente fechado por exceção
      }
      if (exception.startTime && exception.endTime) {
        return {
          startTime: exception.startTime,
          endTime: exception.endTime,
          lunchStartTime: null,
          lunchEndTime: null,
        };
      }
    }

    if (!workingHour || workingHour.isClosed) {
      return null; // Fechado por padrão no dia da semana
    }

    return {
      startTime: workingHour.startTime,
      endTime: workingHour.endTime,
      lunchStartTime: workingHour.lunchStartTime,
      lunchEndTime: workingHour.lunchEndTime,
    };
  }

  /**
   * Calcula todos os slots de horários disponíveis para um determinado serviço em uma data.
   */
  async getAvailableSlots(
    companyId: string,
    serviceId: string,
    dateStr: string,
  ): Promise<AvailableSlotsResponse> {
    // ⚡ O-09: Paraleliza a verificação de empresa, serviço e horário de funcionamento
    const [company, service, schedule] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId, isActive: true },
        select: { id: true },
      }),
      this.prisma.service.findUnique({
        where: { id: serviceId, isActive: true },
        select: {
          id: true,
          companyId: true,
          durationMinutes: true,
          serviceGroupId: true,
          serviceGroup: {
            select: {
              capacity: true,
            },
          },
        },
      }),
      this.resolveWorkingHoursForDate(companyId, dateStr),
    ]);

    if (!company) {
      throw new NotFoundException('Empresa não encontrada ou inativa.');
    }

    if (!service) {
      throw new NotFoundException('Serviço não encontrado ou inativo.');
    }

    if (service.companyId !== company.id) {
      throw new BadRequestException('O serviço não pertence a esta empresa.');
    }

    if (!schedule) {
      return {
        date: dateStr,
        totalAvailable: 0,
        slots: [],
      };
    }

    const durationMinutes = service.durationMinutes;
    const slotStepMinutes = 30; // Passo padrão da grade de agendamentos

    const startMinutes = this.timeToMinutes(schedule.startTime);
    const endMinutes = this.timeToMinutes(schedule.endTime);

    const lunchStartMinutes = schedule.lunchStartTime
      ? this.timeToMinutes(schedule.lunchStartTime)
      : null;
    const lunchEndMinutes = schedule.lunchEndTime
      ? this.timeToMinutes(schedule.lunchEndTime)
      : null;

    const [year, month, day] = dateStr.split('-').map(Number);
    const dayStartFilter = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEndFilter = new Date(
      Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0),
    );

    // Consulta todos os agendamentos ativos concorrentes do dia para o mesmo grupo de serviço
    const activeAppointments = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        status: { notIn: [ApptStatus.CANCELED, ApptStatus.NO_SHOW] },
        appointmentDate: { gte: dayStartFilter, lt: dayEndFilter },
        service: {
          serviceGroupId: service.serviceGroupId,
        },
        OR: [
          { status: { not: ApptStatus.PENDING_PAYMENT } },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        appointmentDate: true,
        appointmentEndDate: true,
      },
    });

    const maxCapacity = service.serviceGroup?.capacity ?? 1;
    const nowMs = Date.now();
    const availableSlots: string[] = [];
    const dayStartMs = dayStartFilter.getTime();

    // Pre-calculate appointment times in milliseconds to avoid O(N * M) Date parsing
    // ⚡ Bolt: Memoize expensive Date parsing outside the slot check loop
    const activeAppointmentsMs = activeAppointments.map((appt) => ({
      startMs: new Date(appt.appointmentDate).getTime(),
      endMs: new Date(appt.appointmentEndDate).getTime(),
    }));

    for (
      let currentMinutes = startMinutes;
      currentMinutes + durationMinutes <= endMinutes;
      currentMinutes += slotStepMinutes
    ) {
      const slotStartMinutes = currentMinutes;
      const slotEndMinutes = currentMinutes + durationMinutes;

      // 1. Verificação de colisão com intervalo de almoço:
      // Intervalo A colide com B se (A.start < B.end) E (A.end > B.start)
      if (lunchStartMinutes !== null && lunchEndMinutes !== null) {
        const collidesWithLunch =
          slotStartMinutes < lunchEndMinutes &&
          slotEndMinutes > lunchStartMinutes;
        if (collidesWithLunch) {
          continue;
        }
      }

      // ⚡ Bolt: Calculate start and end in milliseconds from the start of the UTC day mathematically to avoid expensive Date parsing in loop
      const slotStartMs = dayStartMs + slotStartMinutes * 60000;
      const slotEndMs = dayStartMs + slotEndMinutes * 60000;

      // 2. Exclusão de horários passados caso a data consultada seja hoje
      // ⚡ Bolt: Cache slotStartMs early to do fast integer comparison instead of Date object comparison against now
      if (slotStartMs <= nowMs) {
        continue;
      }

      // 3. Verificação de sobreposição com agendamentos existentes no grupo de serviço

      let overlappingCount = 0;
      for (const appt of activeAppointmentsMs) {
        if (appt.startMs < slotEndMs && appt.endMs > slotStartMs) {
          overlappingCount++;
          if (overlappingCount >= maxCapacity) {
            break;
          }
        }
      }

      if (overlappingCount < maxCapacity) {
        availableSlots.push(this.minutesToTime(currentMinutes));
      }
    }

    return {
      date: dateStr,
      totalAvailable: availableSlots.length,
      slots: availableSlots,
    };
  }

  /**
   * Valida se um horário pretendido de agendamento está em conformidade com o expediente e não colide com almoço/fechamento.
   */
  async validateSlotWithinWorkingHours(
    companyId: string,
    appointmentStartDate: Date,
    appointmentEndDate: Date,
  ): Promise<void> {
    const year = appointmentStartDate.getUTCFullYear();
    const month = (appointmentStartDate.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0');
    const day = appointmentStartDate.getUTCDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const schedule = await this.resolveWorkingHoursForDate(companyId, dateStr);

    if (!schedule) {
      throw new BadRequestException(
        'A empresa está fechada para atendimento na data selecionada.',
      );
    }

    const apptStartMinutes =
      appointmentStartDate.getUTCHours() * 60 +
      appointmentStartDate.getUTCMinutes();
    const apptEndMinutes =
      appointmentEndDate.getUTCHours() * 60 +
      appointmentEndDate.getUTCMinutes();

    const workStartMinutes = this.timeToMinutes(schedule.startTime);
    const workEndMinutes = this.timeToMinutes(schedule.endTime);

    if (
      apptStartMinutes < workStartMinutes ||
      apptEndMinutes > workEndMinutes
    ) {
      throw new BadRequestException(
        `O horário solicitado (${this.minutesToTime(apptStartMinutes)} - ${this.minutesToTime(apptEndMinutes)}) está fora do expediente de funcionamento (${schedule.startTime} - ${schedule.endTime}).`,
      );
    }

    if (schedule.lunchStartTime && schedule.lunchEndTime) {
      const lunchStart = this.timeToMinutes(schedule.lunchStartTime);
      const lunchEnd = this.timeToMinutes(schedule.lunchEndTime);

      const collidesWithLunch =
        apptStartMinutes < lunchEnd && apptEndMinutes > lunchStart;
      if (collidesWithLunch) {
        throw new BadRequestException(
          `O horário solicitado intercepta o intervalo de almoço da empresa (${schedule.lunchStartTime} às ${schedule.lunchEndTime}).`,
        );
      }
    }
  }
}
