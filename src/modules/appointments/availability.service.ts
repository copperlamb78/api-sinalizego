import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApptStatus } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { DEFAULT_SLOT_STEP_MINUTES } from 'src/common/constants/billing.constant';

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

    // O-09: Paraleliza a busca de exceção e expediente padrão semanal
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
   * Suporta profissional específico ou "Qualquer profissional" (distribuição por capacidade real).
   */
  async getAvailableSlots(
    companyId: string,
    serviceId: string,
    dateStr: string,
    employeeId?: string,
  ): Promise<AvailableSlotsResponse> {
    // O-09: Paraleliza a verificação de empresa, serviço e horário de funcionamento
    const [company, service, schedule] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId, isActive: true },
        select: { id: true, timezone: true },
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

    // Se um funcionário específico foi solicitado, valida existência, status ativo e habilitação no serviço
    if (employeeId && this.prisma.employee) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: employeeId,
          companyId: company.id,
          isActive: true,
          services: {
            some: {
              serviceId: service.id,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException(
          'Profissional não encontrado, inativo ou não habilitado para este serviço.',
        );
      }
    }

    if (!schedule) {
      return {
        date: dateStr,
        totalAvailable: 0,
        slots: [],
      };
    }

    const timezone = company.timezone || 'America/Sao_Paulo';
    const durationMinutes = service.durationMinutes;
    const slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES;

    const startMinutes = this.timeToMinutes(schedule.startTime);
    const endMinutes = this.timeToMinutes(schedule.endTime);

    const lunchStartMinutes = schedule.lunchStartTime
      ? this.timeToMinutes(schedule.lunchStartTime)
      : null;
    const lunchEndMinutes = schedule.lunchEndTime
      ? this.timeToMinutes(schedule.lunchEndTime)
      : null;

    // Converte início e fim do dia na timezone da empresa para instantes UTC (AG-02, AG-07)
    const dayStartFilter = fromZonedTime(`${dateStr}T00:00:00.000`, timezone);
    const dayEndFilter = fromZonedTime(`${dateStr}T23:59:59.999`, timezone);

    // Identifica profissionais elegíveis para o serviço nesta empresa
    const eligibleEmployees = this.prisma.employee
      ? await this.prisma.employee.findMany({
          where: {
            companyId: company.id,
            isActive: true,
            ...(employeeId
              ? { id: employeeId }
              : {
                  services: {
                    some: {
                      serviceId: service.id,
                    },
                  },
                }),
          },
          select: {
            id: true,
          },
        })
      : [];

    const hasIndividualEmployees = eligibleEmployees.length > 0;

    // Consulta agendamentos ativos concorrentes do dia local
    const activeAppointments = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        status: { notIn: [ApptStatus.CANCELED, ApptStatus.NO_SHOW] },
        appointmentDate: { gte: dayStartFilter, lte: dayEndFilter },
        ...(hasIndividualEmployees
          ? { employeeId: { in: eligibleEmployees.map((e) => e.id) } }
          : { service: { serviceGroupId: service.serviceGroupId } }),
        OR: [
          { status: { not: ApptStatus.PENDING_PAYMENT } },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        employeeId: true,
        appointmentDate: true,
        appointmentEndDate: true,
      },
    });

    const maxCapacity = hasIndividualEmployees
      ? eligibleEmployees.length
      : service.serviceGroup?.capacity ?? 1;

    const nowMs = Date.now();
    const availableSlots: string[] = [];
    const dayStartMs = dayStartFilter.getTime();

    // Pré-calcula os instantes dos agendamentos em milissegundos
    const activeAppointmentsMs = activeAppointments.map((appt) => ({
      employeeId: appt.employeeId,
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
      if (lunchStartMinutes !== null && lunchEndMinutes !== null) {
        const collidesWithLunch =
          slotStartMinutes < lunchEndMinutes &&
          slotEndMinutes > lunchStartMinutes;
        if (collidesWithLunch) {
          continue;
        }
      }

      const slotStartMs = dayStartMs + slotStartMinutes * 60000;
      const slotEndMs = dayStartMs + slotEndMinutes * 60000;

      // 2. Exclusão de horários passados caso a data consultada seja hoje
      if (slotStartMs <= nowMs) {
        continue;
      }

      // 3. Verificação de disponibilidade
      if (employeeId) {
        // Profissional específico: livre se não tiver colisão com seus próprios agendamentos
        const hasCollision = activeAppointmentsMs.some(
          (appt) =>
            appt.employeeId === employeeId &&
            appt.startMs < slotEndMs &&
            appt.endMs > slotStartMs,
        );
        if (!hasCollision) {
          availableSlots.push(this.minutesToTime(currentMinutes));
        }
      } else if (hasIndividualEmployees) {
        // "Qualquer profissional": disponível se pelo menos 1 profissional elegível estiver livre
        const hasFreeEmployee = eligibleEmployees.some((emp) => {
          const hasCollision = activeAppointmentsMs.some(
            (appt) =>
              appt.employeeId === emp.id &&
              appt.startMs < slotEndMs &&
              appt.endMs > slotStartMs,
          );
          return !hasCollision;
        });

        if (hasFreeEmployee) {
          availableSlots.push(this.minutesToTime(currentMinutes));
        }
      } else {
        // Fallback legado baseado na capacidade do grupo
        const overlappingCount = activeAppointmentsMs.filter(
          (appt) => appt.startMs < slotEndMs && appt.endMs > slotStartMs,
        ).length;

        if (overlappingCount < maxCapacity) {
          availableSlots.push(this.minutesToTime(currentMinutes));
        }
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
    companyTimezone?: string,
  ): Promise<void> {
    if (
      appointmentStartDate.getUTCSeconds() !== 0 ||
      appointmentStartDate.getUTCMilliseconds() !== 0
    ) {
      throw new BadRequestException(
        'Horário do agendamento deve conter segundos e milissegundos zerados.',
      );
    }

    let timezone = companyTimezone;
    if (!timezone) {
      const comp = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { timezone: true },
      });
      timezone = comp?.timezone || 'America/Sao_Paulo';
    }

    // Converte o instante UTC para a hora de parede na timezone da empresa (AG-02)
    const localStart = toZonedTime(appointmentStartDate, timezone);
    const localEnd = toZonedTime(appointmentEndDate, timezone);

    const year = localStart.getFullYear();
    const month = (localStart.getMonth() + 1).toString().padStart(2, '0');
    const day = localStart.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const schedule = await this.resolveWorkingHoursForDate(companyId, dateStr);

    if (!schedule) {
      throw new BadRequestException(
        'A empresa está fechada para atendimento na data selecionada.',
      );
    }

    const apptStartMinutes =
      localStart.getHours() * 60 + localStart.getMinutes();
    const apptEndMinutes = localEnd.getHours() * 60 + localEnd.getMinutes();

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

    // Validação de alinhamento com a grade de horários (AG-05)
    if (
      (apptStartMinutes - workStartMinutes) % DEFAULT_SLOT_STEP_MINUTES !==
      0
    ) {
      throw new BadRequestException(
        `O horário solicitado (${this.minutesToTime(apptStartMinutes)}) não está alinhado com a grade de agendamentos de ${DEFAULT_SLOT_STEP_MINUTES} minutos.`,
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
